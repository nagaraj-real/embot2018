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
const ONBOARDING_BEGIN = 'onboarding.begin';
const ONBOARDING_BASICDETAILS = 'onboarding.basicinfo';
const ONBOARDING_COMPANYDETAILS = 'onboarding.companydetails';
const ONBOARDING_CHANGE = 'onboarding.begin.change';

const FOOD_SELECTED = 'thinking about lunch ah?';

const App = require('actions-on-google').ApiAiApp;

const functions = require('firebase-functions');

let lunchvalues = [];

let users = [];

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


database.ref('users').orderByChild("emailid").equalTo("raj.nagaraj1990@gmail.com").once('value').then(function (snapshot) {
  users = snapshot.val();
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
    orderId: app.data.lunchdata.orderId,
    date: currdate,
    status: 'pending',
    tax: app.data.lunchdata.tax,
    totalcost: app.data.lunchdata.totalcost,
    users: user,
    lunchitems: app.data.lunchdata.foodItems,
    coordinates: app.data.deviceCoordinates
  };

  let updates = {};
  updates['/lunchorders/' + app.data.lunchdata.orderId] = orderData;


  database.ref().update(updates).then((msg) => {
    console.log(msg);
    app.data.lunchdata = {};
  }, (error) => {
    console.log(error);
  });;
}

exports.embothook = functions.https.onRequest((request, response) => {


  const app = new App({ request, response });
  app.data.lunchdata = {};
  app.data.lunchdata.foodItems = {};
  app.data.user = {};
  app.data.user.key = Object.keys(users)[0];
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
    if (app.data.lunchdata.foodItems[lunch]) {
      app.data.lunchdata.foodItems[lunch].quantity = parseInt(app.data.lunchdata.foodItems[lunch].quantity) + parseInt(lunchItem.quantity);
    } else {
      app.data.lunchdata.foodItems[lunch] = lunchItem
    }

    app.askForConfirmation('add more items?');

  }

  function transactionDecision(app) {
    let buildItems = [];
    let subtotal = 0;
    let tax = 5;
    Object.keys(app.data.lunchdata.foodItems).forEach(function (key) {
      let foodItem = app.data.lunchdata.foodItems[key];
      buildItems.push(app.buildLineItem(foodItem.value, foodItem.value)
        .setPrice(app.Transactions.PriceType.ACTUAL, 'INR', (foodItem.quantity * foodItem.cost))
        .setQuantity(foodItem.quantity))
      subtotal = subtotal + (foodItem.quantity * foodItem.cost);
    })
    app.data.lunchdata.totalcost = subtotal;
    app.data.lunchdata.tax = tax;
    app.data.lunchdata.orderId = firebase.database().ref().child('lunchorders').push().key;
    let order = app.buildOrder(app.data.lunchdata.orderId)
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
              confirmedActionOrderId: app.data.lunchdata.orderId
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
        .addSimpleResponse(`Hello ${app.data.displayName}, I am EM bot.What can I help you with?`, [`Hi ${app.data.displayName} welcome !!`])
        .addSuggestions(
        ['Book Lunch', 'Onboarding', 'Leave Management', 'True time'])
      );
    } else {
      app.tell('Ok Bye')
    }


  }

  function onBoardingBegin(app) {

    if (users[app.data.user.key].status === 'UPLOAD') {
      app.data.user.basicinfo = users[app.data.user.key].basicinfo;
      app.data.user.companydetails = users[app.data.user.key].companydetails;
      app.ask(app.buildRichResponse()
        .addSimpleResponse('You need to upload documents to proceed.Please come back after uploading to check the status')
        .addBasicCard(app.buildBasicCard(`
    **Name** : ${app.data.user.basicinfo.givenname}    
    **Phonennumber** : ${app.data.user.basicinfo.phonennumber}  
    **Address** : ${app.data.user.basicinfo.address}  
    **Date of Birth** : ${app.data.user.basicinfo.dob}    
    **Current Company** : ${app.data.user.companydetails.companyname}     
    **Current CTC** : ${app.data.user.companydetails.currentctc.amount} ${app.data.user.companydetails.currentctc.currency}  
    **Expected CTC** : ${app.data.user.companydetails.expectedctc.amount} ${app.data.user.companydetails.expectedctc.currency}  
    **Experience** : ${app.data.user.companydetails.experience} years   
    **Skills** : ${app.data.user.companydetails.skills.toString()} 
        `)
          .setTitle('Profile')
          .addButton('Upload the documents here')
          .setImage(users[app.data.user.key].imageurl, 'Image alternate text')
        ).addSuggestions(
        ['change something', 'ok bye'])
      );
           
    
    } else {

      app.ask(`Hi ${app.data.displayName},welcome to cognizant family.I will help you with your on boarding process.Please provide your full name`);

    }


  }

  function onBaoardingBasicInfo(app) {
    let basicinfo = {};
    basicinfo.address = app.getArgument('address');
    basicinfo.phonennumber = app.getArgument('phonenumber');
    basicinfo.givenname = app.getArgument('given-name');
    basicinfo.dob = app.getArgument('dob');

    app.data.user.basicinfo = basicinfo;
    let updates = {};
    updates['/users/' + app.data.user.key + '/basicinfo'] = basicinfo;


    database.ref().update(updates).then((msg) => {
      console.log(msg);
    }, (error) => {
      console.log(error);
    });;


    app.ask(`Now that we have your basic information,let us have more information about your organization.What is the current organization you are working for?`);
    //app.setContext('onboarding_basicinfo-followup ');

  }

  function onBaoardingCompanyDetails(app) {
    let companydetails = {};
    companydetails.currentctc = app.getArgument('currentctc');
    companydetails.expectedctc = app.getArgument('expectedctc');
    companydetails.experience = app.getArgument('experience');
    companydetails.companyname = app.getArgument('companyname');
    companydetails.skills = app.getArgument('skills');
    app.data.user.companydetails = companydetails;
    let updates = {};
    updates['/users/' + app.data.user.key + '/companydetails'] = companydetails;


    database.ref().update(updates).then((msg) => {
      console.log(msg);
    }, (error) => {
      console.log(error);
    });
    app.data.user.basicinfo = users[app.data.user.key].basicinfo;
    app.data.user.companydetails = users[app.data.user.key].companydetails;
    app.ask(app.buildRichResponse()
      .addSimpleResponse('You need to upload documents to proceed.Please come back after uploading to check the status')
      .addBasicCard(app.buildBasicCard(`
    **Name** : ${app.data.user.basicinfo.givenname}    
    **Phonennumber** : ${app.data.user.basicinfo.phonennumber}  
    **Address** : ${app.data.user.basicinfo.address}  
    **Date of Birth** : ${app.data.user.basicinfo.dob}    
    **Current Company** : ${app.data.user.companydetails.companyname}     
    **Current CTC** : ${app.data.user.companydetails.currentctc.amount} ${app.data.user.companydetails.currentctc.currency}  
    **Expected CTC** : ${app.data.user.companydetails.expectedctc.amount} ${app.data.user.companydetails.expectedctc.currency}  
    **Experience** : ${app.data.user.companydetails.experience} years   
    **Skills** : ${app.data.user.companydetails.skills.toString()} 
        `)
        .setTitle('Profile')
        .addButton('Upload the documents here')
        .setImage(users[app.data.user.key].imageurl, 'Image alternate text')
      ).addSuggestions(
      ['change something', 'ok bye'])
    );
  }

  function onBaoardingChange(app){
      let context = app.getContext('onboarding_begin_change-followup');
      context.parameters['given-name']='John';
      app.setContext('onboarding_begin_change-followup', 1, context.parameters);
      app.ask('what you wanna change');
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
  actionMap.set(ONBOARDING_BEGIN, onBoardingBegin);
  actionMap.set(ONBOARDING_BASICDETAILS, onBaoardingBasicInfo)
  actionMap.set(ONBOARDING_COMPANYDETAILS, onBaoardingCompanyDetails)
  actionMap.set(ONBOARDING_CHANGE, onBaoardingChange)
  app.handleRequest(actionMap);

});
