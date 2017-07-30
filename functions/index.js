'use strict';

const ORDER_LUNCH = 'order.lunch';
const SELECT_LUNCH = 'select.lunch';
const ORDER_LUNCH_SELECT_CONFIRM = 'orderlunch.select.confirm';
const TRANSACTION_CHECK_COMPLETE = 'transaction.check.complete';
const TRANSACTION_DECISION_COMPLETE = 'transaction.decision.complete';
const CART_CHANGE_REQUESTED = 'CART_CHANGE_REQUESTED';
const ADD_MORE_CONFIRM = 'add.more.confirm';
const PERMISSION_GRANTED = 'permission.granted';
const INPUT_WELCOME = 'input.welcome';

const FOOD_SELECTED = 'thinking about lunch ah?';

const App = require('actions-on-google').ApiAiApp;

const functions = require('firebase-functions');

let lunchvalues = [];

const firebase = require("firebase");

let config = {
  apiKey: "AIzaSyAXzRU0nDru3KS8PxBBB8OR60pqHhFu4No",
  authDomain: "embot-5c0ae.firebaseapp.com",
  databaseURL: "https://embot-5c0ae.firebaseio.com/",
  storageBucket: "gs://embot-5c0ae.appspot.com",
};

let orderItems = {

}

firebase.initializeApp(config);

const database = firebase.database();

database.ref('lunchitems').once('value').then(function (snapshot) {
  lunchvalues = snapshot.val();
}, function (err) {
  console.log(err);
});

function getLunchItem(key) {
  return lunchvalues[key];
}

function saveOrder(app) {

  let currdate = new Date();
  let user = {};
  user[app.data.userId] = app.data.userId;
  let orderData = {
    orderId: app.data.orderId,
    date: currdate,
    status: 'pending',
    tax: app.data.tax,
    totalcost: app.data.totalcost,
    users: user,
    lunchitems: app.data.foodItems,
    coordinates: app.data.deviceCoordinates
  };

  let updates = {};
  updates['/lunchorders/' + app.data.orderId] = orderData;


  database.ref().update(updates).then((msg) => {
    console.log(msg);
  }, (error) => {
    console.log(error);
  });;
}

exports.embothook = functions.https.onRequest((request, response) => {

  const app = new App({ request, response });
  app.data.foodItems = {};
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));

  function orderlunch(app, addmore) {
    let text = 'Alright what are you in the mood for?'
    if (addmore) {
      text = 'All right!! which dish you would like to add'
    }
    let buildlist = app.buildList('Most popular choices');
    Object.keys(lunchvalues).forEach(function (key) {
      let item = lunchvalues[key];
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
    let quantity = app.getArgument('Quantity');
    let lunch = app.getArgument('Lunch');
    let lunchItem = getLunchItem(lunch);
    lunchItem.quantity = quantity;
    if (app.data.foodItems[lunch]) {
      app.data.foodItems[lunch].quantity = parseInt(app.data.foodItems[lunch].quantity) + parseInt(lunchItem.quantity);
    } else {
      app.data.foodItems[lunch] = lunchItem
    }

    app.askForConfirmation('add more items?');

  }

  function transactionDecision(app) {
    let buildItems = [];
    let subtotal = 0;
    let tax = 5;
    Object.keys(app.data.foodItems).forEach(function (key) {
      let foodItem = app.data.foodItems[key];
      buildItems.push(app.buildLineItem(foodItem.value, foodItem.value)
        .setPrice(app.Transactions.PriceType.ACTUAL, 'INR', (foodItem.quantity * foodItem.cost))
        .setQuantity(foodItem.quantity))
      subtotal = subtotal + (foodItem.quantity * foodItem.cost);
    })
    app.data.totalcost = subtotal;
    app.data.tax = tax;
    app.data.orderId = firebase.database().ref().child('lunchorders').push().key;
    let order = app.buildOrder(app.data.orderId)
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
      saveOrder(app);
      let googleOrderId = app.getTransactionDecision().order.googleOrderId;
      if (googleOrderId) {
        app.tell(app.buildRichResponse().addOrderUpdate(
          app.buildOrderUpdate(googleOrderId, true)
            .setOrderState(app.Transactions.OrderState.CREATED, 'Order created')
            .setInfo(app.Transactions.OrderStateInfo.RECEIPT, {
              confirmedActionOrderId: app.data.orderId
            }))
          .addSimpleResponse('Transaction completed! You\'re all set!'));
      }
      else {
        app.tell('Transaction completed! You\'re all set!')
      }
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

  function inputwelcome(app) {
    let namePermission = app.SupportedPermissions.NAME;
    let preciseLocationPermission = app.SupportedPermissions.DEVICE_PRECISE_LOCATION
    app.askForPermissions('To address you by name and know your location',
      [namePermission, preciseLocationPermission]);
  }

  function permgranted(app) {
    if (app.isPermissionGranted()) {
      app.data.displayName = app.getUserName().givenName;
      app.data.userId = app.getUser().userId;
      app.data.deviceCoordinates = app.getDeviceLocation().coordinates;

      app.ask(app.buildRichResponse()
        .addSimpleResponse(`Hello ${app.data.displayName}, I am EM bot.What can I help you with?`, ['Hi ${app.data.displayName} welcome !!'])
        .addSuggestions(
        ['Book Lunch', 'Process Visa', 'Leave Management', 'True time'])
      );
    } else {
      app.tell('Ok Bye')
    }


  }


  let actionMap = new Map();
  actionMap.set(INPUT_WELCOME, inputwelcome);
  actionMap.set(PERMISSION_GRANTED, permgranted);
  actionMap.set(ORDER_LUNCH, orderlunch);
  actionMap.set(SELECT_LUNCH, selectlunch);
  actionMap.set(ORDER_LUNCH_SELECT_CONFIRM, selectlunch);
  actionMap.set(TRANSACTION_CHECK_COMPLETE, transactionCheckComplete);
  actionMap.set(TRANSACTION_DECISION_COMPLETE, transactionDecisionComplete);
  actionMap.set(ADD_MORE_CONFIRM, addMoreConfirm);
  app.handleRequest(actionMap);

});
