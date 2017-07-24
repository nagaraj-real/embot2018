'use strict';

const ORDER_LUNCH = 'order.lunch';
const SELECT_LUNCH = 'select.lunch';
const ORDER_LUNCH_SELECT_CONFIRM = 'orderlunch.select.confirm';
const TRANSACTION_CHECK_COMPLETE = 'transaction.check.complete';
const TRANSACTION_DECISION_COMPLETE = 'transaction.decision.complete';
const CART_CHANGE_REQUESTED ='CART_CHANGE_REQUESTED';
const ADD_MORE_CONFIRM  ='add.more.confirm';

const FOOD_SELECTED = 'thinking about lunch ah?';

const App = require('actions-on-google').ApiAiApp;

const functions = require('firebase-functions');

const LUNCH_VALUES=[
  {
    key:'CHICKEN_BIRIYANI',
    value:'Chicken Biriyani',
    cost:100
  },
  {
    key:'CHAPATI_CHICKEN',
    value:'Chapati Chicken Combo',
    cost:75
  },
  {
    key:'NON_VEG_THALI',
    value:'Non Veg Thali',
    cost:110
  },
  {
    key:'VEG_BIRIYANI',
    value:'Veg Biriyani',
    cost:90
  },
  {
    key:'VEG_THALI',
    value:'Veg Thali',
    cost:100
  }
]

const LUNCH_IMAGES = [
  [
    'https://firebasestorage.googleapis.com/v0/b/embot-5c0ae.appspot.com/o/lunch_top_dishes%2Fchicken-biriyani.png?alt=media&token=02946867-48f1-4796-845e-62616d594940',
    'Chicken Biriyani'
  ],
  [
    'https://firebasestorage.googleapis.com/v0/b/embot-5c0ae.appspot.com/o/lunch_top_dishes%2Fchapathi-chicken.jpg?alt=media&token=170f3475-b98d-4c9a-88d1-b15d5bb7a38c',
    'Chapati Chicken Combo'
  ],
  [
    'https://firebasestorage.googleapis.com/v0/b/embot-5c0ae.appspot.com/o/lunch_top_dishes%2FNon-Veg-Thali.png?alt=media&token=ec3b5b1e-351c-49fe-827f-f3fa1887c57b',
    'Non Veg Thali'
  ],
  [
    'https://firebasestorage.googleapis.com/v0/b/embot-5c0ae.appspot.com/o/lunch_top_dishes%2Fveg-biryani.png?alt=media&token=dc2f77f4-5f65-4baa-8245-884015c0ad34',
    'Veg Biriyani'
  ],
  [
    'https://firebasestorage.googleapis.com/v0/b/embot-5c0ae.appspot.com/o/lunch_top_dishes%2FVeg_Thali.png?alt=media&token=9a0926d3-dc39-4594-b820-175bda7eaf34',
    'Veg Thali'
  ]
];


function getLunchItem(key){
  var filtered = LUNCH_VALUES.filter(function(item){
      return item.key===key;
  });
  return filtered;
}

exports.embothook = functions.https.onRequest((request, response) => {
  const app = new App({ request, response });
  app.data.foodItems=[];
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));
  function orderlunch(app,addmore) {
    let text='Alright what are you in the mood for?'
    if(addmore){
       text='All right!! which dish you would like to add'
    }
    var lunchimage = LUNCH_IMAGES;
    app.askWithList(app.buildRichResponse()
      .addSimpleResponse(text),
      // Build a list
      app.buildList('Most popular choices')
        // Add the first item to the list
        .addItems(app.buildOptionItem('CHICKEN_BIRIYANI',
          ['chicken & biriyani'])
          .setTitle('Chicken Biriyani')
          .setDescription('Hyderabad chicken biriyani at 100 Rs')
          .setImage(lunchimage[0][0], lunchimage[0][1]))
        // Add the second item to the list
        .addItems(app.buildOptionItem('CHAPATI_CHICKEN',
          ['chapati & chicken'])
          .setTitle('Chapati and Chicken Combo')
          .setDescription('3 chapatis with hot chicken gravy at 75 Rs')
          .setImage(lunchimage[1][0], lunchimage[1][1])
        )
        // Add third item to the list
        .addItems(app.buildOptionItem('NON_VEG_THALI',
          ['thali', 'non-veg'])
          .setTitle('Non-Veg Thali')
          .setDescription('Non-Veg thali with 4 Non Veg dishes at 110 Rs')
          .setImage(lunchimage[2][0], lunchimage[2][1])
        )
        .addItems(app.buildOptionItem('VEG_BIRIYANI',
          ['veg-biriyani'])
          .setTitle('Veg Biriyani')
          .setDescription('Spicy Veg Biriyani at 90Rs')
          .setImage(lunchimage[3][0], lunchimage[3][1])
        )
        .addItems(app.buildOptionItem('VEG_THALI',
          ['veg-thali'])
          .setTitle('Veg Thali')
          .setDescription('Veg thali with 3 Veg dishes and payasam at 100 Rs')
          .setImage(lunchimage[4][0], lunchimage[4][1])
        )

    );
  }

  function selectlunch(app) {
    var quantity = app.getArgument('Quantity');
    var lunch = app.getArgument('Lunch');
    var lunchItem = getLunchItem(lunch)[0];
    var selectedLunch= lunchItem.value;
    var selectedQuantity= quantity;
    var selectedCost= quantity * lunchItem.cost;

    app.data.foodItems.push({'selectedLunch':selectedLunch,
    'selectedQuantity':selectedQuantity,'selectedCost':selectedCost});

    app.askForConfirmation('add more items?');
    //app.ask('Gotcha!! '+ getLunchItem(Lunch)[0].value +' - '+quantity+' plates coming right away' );
    //app.askForTransactionRequirements();
  }

  function transactionDecision (app) {
    var buildItems=[];
    var subtotal=0;
    var tax=5;
    app.data.foodItems.forEach(function(foodItem){
      buildItems.push(app.buildLineItem(foodItem.selectedLunch, foodItem.selectedLunch)
            .setPrice(app.Transactions.PriceType.ACTUAL, 'INR',foodItem.selectedCost)
            .setQuantity(foodItem.selectedQuantity))
            subtotal=subtotal+foodItem.selectedCost;
    })
    let order = app.buildOrder('321432')
      .setCart(app.buildCart().setMerchant('Carnival FC', 'Carnival FC')
        .addLineItems(buildItems).setNotes('Lunch Items'))
      .addOtherItems([
        app.buildLineItem('subtotal', 'Subtotal')
          .setType(app.Transactions.ItemType.SUBTOTAL)
          .setQuantity(1)
          .setPrice(app.Transactions.PriceType.ESTIMATE, 'INR', subtotal),
        app.buildLineItem('tax', 'Tax')
          .setType(app.Transactions.ItemType.TAX)
          .setQuantity(1)
          .setPrice(app.Transactions.PriceType.ESTIMATE, 'INR', tax)
      ])
      .setTotalPrice(app.Transactions.PriceType.ESTIMATE, 'INR', (subtotal+tax));

    // If in sandbox testing mode, do not require payment
    if (app.isInSandbox()) {
      app.askForTransactionDecision(order);
    } else {
      // To test this sample, uncheck the 'Testing in Sandbox Mode' box in the
      // Actions console simulator
      app.askForTransactionDecision(order, {
        type: app.Transactions.PaymentType.PAYMENT_CARD,
        displayName: 'VISA-1234',
        deliveryAddressRequired: false
      });

      /*
        // If using Google provided payment instrument instead
        app.askForTransactionDecision(order, {
          // These will be provided by payment processor, like Stripe,
          // Braintree, or Vantiv
          tokenizationParameters: {},
          cardNetworks: [
            app.Transactions.CardNetwork.VISA,
            app.Transactions.CardNetwork.AMEX
          ],
          prepaidCardDisallowed: false,
          deliveryAddressRequired: false
        });
      */
    }
  }

  function transactionCheckComplete(app){
    if (app.getTransactionRequirementsResult().resultType ===
      app.Transactions.ResultType.ACCEPTED) {
      // Normally take the user through cart building flow
      transactionDecision(app);
    } else {
      app.tell('Transaction failed.');
    }
  }

   function transactionDecisionComplete (app) {
    if (app.getTransactionDecision() &&
      app.getTransactionDecision().userDecision ===
        app.Transactions.ConfirmationDecision.ACCEPTED) {
      let googleOrderId = app.getTransactionDecision().order.googleOrderId;

      // Confirm order and make any charges in order processing backend
      // If using Google provided payment instrument:
      // let paymentToken = app.getTransactionDecision().order.paymentInfo
      //   .googleProvidedPaymentInstrument.instrumentToken;

      app.tell(app.buildRichResponse().addOrderUpdate(
        app.buildOrderUpdate(googleOrderId, true)
          .setOrderState(app.Transactions.OrderState.CREATED, 'Order created')
          .setInfo(app.Transactions.OrderStateInfo.RECEIPT, {
            confirmedActionOrderId: '321432'
          }))
        .addSimpleResponse('Transaction completed! You\'re all set!'));
    } else if (app.getTransactionDecision() &&
      app.getTransactionDecision().userDecision ===
        app.Transactions.ConfirmationDecision.CART_CHANGE_REQUESTED) {
      return orderlunch(app,true);
    } else {
      app.tell('Transaction failed.');
    }
  }

  function addMoreConfirm(app){
    if (app.getUserConfirmation()) {
      orderlunch(app,true)
    } else {
      app.askForTransactionRequirements();
    }
  }





  let actionMap = new Map();
  //actionMap.set(UNRECOGNIZED_DEEP_LINK, unhandledDeepLinks);
  actionMap.set(ORDER_LUNCH, orderlunch);
  actionMap.set(SELECT_LUNCH, selectlunch);
  actionMap.set(ORDER_LUNCH_SELECT_CONFIRM, selectlunch);
  actionMap.set(TRANSACTION_CHECK_COMPLETE, transactionCheckComplete);
  actionMap.set(TRANSACTION_DECISION_COMPLETE, transactionDecisionComplete);
  actionMap.set(ADD_MORE_CONFIRM, addMoreConfirm);
  app.handleRequest(actionMap);

});
