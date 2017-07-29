'use strict';

const ORDER_LUNCH = 'order.lunch';
const SELECT_LUNCH = 'select.lunch';
const ORDER_LUNCH_SELECT_CONFIRM = 'orderlunch.select.confirm';
const TRANSACTION_CHECK_COMPLETE = 'transaction.check.complete';
const TRANSACTION_DECISION_COMPLETE = 'transaction.decision.complete';
const CART_CHANGE_REQUESTED = 'CART_CHANGE_REQUESTED';
const ADD_MORE_CONFIRM = 'add.more.confirm';

const FOOD_SELECTED = 'thinking about lunch ah?';

const App = require('actions-on-google').ApiAiApp;

const functions = require('firebase-functions');

let lunchvalues = [];

const firebase = require("firebase");

var config = {
  apiKey: "AIzaSyAXzRU0nDru3KS8PxBBB8OR60pqHhFu4No",
  authDomain: "embot-5c0ae.firebaseapp.com",
  databaseURL: "https://embot-5c0ae.firebaseio.com/",
  storageBucket: "gs://embot-5c0ae.appspot.com",
};

firebase.initializeApp(config);

const database = firebase.database();

database.ref('lunchitem').once('value').then(function (snapshot) {
  lunchvalues = snapshot.val();
}, function (err) {
  console.log(err);
});

function getLunchItem(key) {
  var filtered = lunchvalues.filter(function (item) {
    return item.key === key;
  });
  return filtered;
}

exports.embothook = functions.https.onRequest((request, response) => {

  const app = new App({ request, response });
  app.data.foodItems = [];
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));
  function orderlunch(app, addmore) {
    let text = 'Alright what are you in the mood for?'
    if (addmore) {
      text = 'All right!! which dish you would like to add'
    }
    let buildlist = app.buildList('Most popular choices');
    lunchvalues.forEach(function (item) {
      buildlist.addItems(app.buildOptionItem(item.key,
        [item.value])
        .setTitle(item.value)
        .setDescription(item.description)
        .setImage(item.imageurl, item.value));
    });
    app.askWithList(app.buildRichResponse()
      .addSimpleResponse(text),
      buildlist
    );
  }

  function selectlunch(app) {
    var quantity = app.getArgument('Quantity');
    var lunch = app.getArgument('Lunch');
    var lunchItem = getLunchItem(lunch)[0];
    var selectedLunch = lunchItem.value;
    var selectedQuantity = quantity;
    var selectedCost = quantity * lunchItem.cost;

    app.data.foodItems.push({
      'selectedLunch': selectedLunch,
      'selectedQuantity': selectedQuantity, 'selectedCost': selectedCost
    });

    app.askForConfirmation('add more items?');

  }

  function transactionDecision(app) {
    var buildItems = [];
    var subtotal = 0;
    var tax = 5;
    app.data.foodItems.forEach(function (foodItem) {
      buildItems.push(app.buildLineItem(foodItem.selectedLunch, foodItem.selectedLunch)
        .setPrice(app.Transactions.PriceType.ACTUAL, 'INR', foodItem.selectedCost)
        .setQuantity(foodItem.selectedQuantity))
      subtotal = subtotal + foodItem.selectedCost;
    })
    let order = app.buildOrder('321450')
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
      .setTotalPrice(app.Transactions.PriceType.ESTIMATE, 'INR', (subtotal + tax));

    if (app.isInSandbox()) {
      app.askForTransactionDecision(order);
    } else {
      app.askForTransactionDecision(order, {
        type: app.Transactions.PaymentType.PAYMENT_CARD,
        displayName: 'VISA-1234',
        deliveryAddressRequired: false
      });

    }
  }

  function transactionCheckComplete(app) {
    if (app.getTransactionRequirementsResult().resultType ===
      app.Transactions.ResultType.ACCEPTED) {
      // Normally take the user through cart building flow
      transactionDecision(app);
    } else {
      app.tell('Transaction failed.');
    }
  }

  function transactionDecisionComplete(app) {
    if (app.getTransactionDecision() &&
      app.getTransactionDecision().userDecision ===
      app.Transactions.ConfirmationDecision.ACCEPTED) {
      let googleOrderId = app.getTransactionDecision().order.googleOrderId;

      app.tell(app.buildRichResponse().addOrderUpdate(
        app.buildOrderUpdate(googleOrderId, true)
          .setOrderState(app.Transactions.OrderState.CREATED, 'Order created')
          .setInfo(app.Transactions.OrderStateInfo.RECEIPT, {
            confirmedActionOrderId: '321450'
          }))
        .addSimpleResponse('Transaction completed! You\'re all set!'));
    } else if (app.getTransactionDecision() &&
      app.getTransactionDecision().userDecision ===
      app.Transactions.ConfirmationDecision.CART_CHANGE_REQUESTED) {
      return orderlunch(app, true);
    } else {
      app.tell('Transaction failed.');
    }
  }

  function addMoreConfirm(app) {
    if (app.getUserConfirmation()) {
      orderlunch(app, true)
    } else {
      app.askForTransactionRequirements();
    }
  }


  let actionMap = new Map();
  actionMap.set(ORDER_LUNCH, orderlunch);
  actionMap.set(SELECT_LUNCH, selectlunch);
  actionMap.set(ORDER_LUNCH_SELECT_CONFIRM, selectlunch);
  actionMap.set(TRANSACTION_CHECK_COMPLETE, transactionCheckComplete);
  actionMap.set(TRANSACTION_DECISION_COMPLETE, transactionDecisionComplete);
  actionMap.set(ADD_MORE_CONFIRM, addMoreConfirm);
  app.handleRequest(actionMap);

});
