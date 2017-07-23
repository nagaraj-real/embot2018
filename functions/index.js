'use strict';

const ORDER_LUNCH = 'order.lunch';
const SELECT_LUNCH = 'select.lunch';
const ORDER_LUNCH_SELECT_CONFIRM = 'orderlunch.select.confirm';

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

function getRandomImage(images) {
  let randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}

function getLunchItem(key){
  var filtered = LUNCH_VALUES.filter(function(item){
      return item.key===key;
  });
  return filtered;
}

//functions.https.onRequest()

exports.embothook = (request, response) => {
  const app = new App({ request, response });
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));
  app.setContext('order_lunch-followup');
  function orderlunch(app) {
    var lunchimage = LUNCH_IMAGES;
    app.askWithList(app.buildRichResponse()
      .addSimpleResponse('Alright what are you in the mood for?'),
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
    var Lunch = app.getArgument('Lunch');
    app.ask('Gotcha!! '+ getLunchItem(Lunch)[0].value +' - '+quantity+' plates coming right away' );
  }



  let actionMap = new Map();
  //actionMap.set(UNRECOGNIZED_DEEP_LINK, unhandledDeepLinks);
  actionMap.set(ORDER_LUNCH, orderlunch);
  actionMap.set(SELECT_LUNCH, selectlunch);
  actionMap.set(ORDER_LUNCH_SELECT_CONFIRM, selectlunch);
  app.handleRequest(actionMap);

};
