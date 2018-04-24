
const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const datatables = require('angular-datatables');
// Check to see if app is running in development environemnt

var knex = require('knex')({
  client:"sqlite3",
  connection: {
    filename: "canteen.db"
  },
  useNullAsDefault: true
});
var mainWindow;

app.on('ready',function(){

  mainWindow = new BrowserWindow({width:1024,height:500,backgroundColor: '#2e2c29',frame:false,fullscreen:true});
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname,'index.html'),
      protocol:'file:',
      slashes:true
    })
  );

  globalShortcut.register('CmdOrCtrl+Shift+d',function(){
    mainWindow.webContents.toggleDevTools();
  });
  globalShortcut.register('CmdOrCtrl+Shift+q',function(){
    app.quit();
  });

  mainWindow.setTitle('Canteen System');
  mainWindow.on('closed', function() {
    mainWindow = null;
  });


  // IPC Functions

  ipcMain.on('clearAllTransactionDataEverywhere',async function() {
    console.log('clearing all data');
    let result = knex("Transactions").where('id','>',0).del();
    result.then(function(result){
      console.log('[OPERATION WIDE] Deleted All Transaction Data');
      let results = knex.select("*").from("Transactions");
      results.then(function(rows){
        mainWindow.webContents.send('AllTransactionsCleared',rows);
      });
    });
    return true;
  })
  ipcMain.on('RequestHomeStats',async function(){
    let clients = await knex.select('*').from('Workers').asCallback(async function(err, rows){
      if(err) return err;
      return rows;
    });
    let transactions = await knex.select("*").from('Transactions')
    .where({payment:0}).andWhere(knex.raw("transaction_date >= date('now','-5 day')")).orderBy("transaction_date",'desc').limit(50).asCallback(async function(err, rows){
      if(err) return err;

      return rows;
    });

    let total_transactions = await knex.select("*").from('Transactions').where({payment:0}).andWhere(knex.raw("transaction_date >= date('now','-5 day')")).orderBy("transaction_date",'asc').asCallback(async function(err, rows){
      if(err) return err;

      return rows;
    });

    mainWindow.webContents.send('HomeStats',{clients, transactions,total_transactions});
    return true;
  })
  ipcMain.on("transaction.loadDefaultUser",function(evt,id){
    let result = knex.select("*").from("Workers").where('id','=',id).asCallback(function(err, rows){

      mainWindow.webContents.send("transaction.loadDefaultUser",rows[0]);
    });
    return true;
  });
  ipcMain.on("requestWorkerList",function(){
    let result = knex.select("*").from("Workers")
    result.then(function(rows){
      mainWindow.webContents.send("workerListResponse",rows);
    });
  });
  ipcMain.on('transactionSubmit',function(evt,raw){
    var data = JSON.parse(raw);
    var currentDate = new Date().toISOString().slice(0,10);
    let result = knex('Transactions').insert({account_id: data.user.id_num, amount: data.amount, payment: data.payment, transaction_date: currentDate});
    result.then(function(returnval){
      let results = knex.select("*").from("Transactions").where('account_id',data.user.id_num).orderBy('tid','desc');
      results.then(function(rows){
        mainWindow.webContents.send("customerDetailsResponse",rows);
      });
    });
  });
  ipcMain.on('deleteTransaction',function(evt, raw){
    var data = JSON.parse(raw);

    let result = knex('Transactions').where('tid',data.transactionid).del();
    result.then(function(returnval){
      console.log('Transaction with id number: ' + data.transactionid + " has been deleted");
      let results = knex.select("*").from("Transactions").where("account_id",data.client.id_num).orderBy('tid','desc');
      results.then(function(rows){
        mainWindow.webContents.send("customerDetailsResponse",rows);
      });
    });
  });
  ipcMain.on('requestCustomerDetails',function(evt,raw){
    var client = JSON.parse(raw);
    let result = knex.select("*").from("Transactions").where("account_id",client.id_num).orderBy('tid','desc');
    result.then(function(rows){
      mainWindow.webContents.send("customerDetailsResponse",rows);
    });
  });
  ipcMain.on('createClientRequest',async function(evt,raw){
    var client = JSON.parse(raw);
    let customeridcheck = await knex.select("*").from("Workers").where('id_num','=',client.id_num).asCallback(async function(err, rows){
      if(rows.length > 0) {
        mainWindow.webContents.send('duplicateCustomerID');
      }
      return rows.length;
    });
    if(customeridcheck == 0) {
      let result = knex("Workers").insert({
        first_name: client.first_name,
        last_name: client.last_name,
        id_num: client.id_num
      }).then( function(rows){
        let results = knex.select("*").from("Workers").then( function(rows){
          mainWindow.webContents.send('workerListResponse',rows);
        });
      });
    }
    else {
      // Do Nothing
    }

  });
  ipcMain.on('deleteClientRequest',function(evt,raw){
    console.log('Deleting From Workers with id: ' + raw);
    let result = knex("Workers").where('id',raw).del();
    result.then(function(result){
      console.log('Deleted.');
      let results = knex.select("*").from("Workers");
      results.then(function(rows){
        mainWindow.webContents.send('workerListResponse',rows);
      });
    });
  });
  ipcMain.on('requestWorkerInfo',function(evt,raw){
    let result = knex.select("*").from("Workers").where('id',raw);
    result.then(function(res){
      var user = res[0];
      var transactions_data = [];
      let results = knex.select("*").from("Transactions").where('account_id',user.id_num).orderBy('tid','desc');
      results.then(function(rows){
        transactions_data = rows;
        var returnObj = {user: res[0],transactions: rows};
        mainWindow.webContents.send('recieveWorkerInfo',returnObj);
      });

    });
  });

  ipcMain.on('UpdateClientInfo',function(evt,raw){
    var data = JSON.parse(raw);
    let results = knex.select('*').from('Workers').where('id',data.id);
    var original_id = 0;
    results.then(function(rows){
      original_id = rows[0].id_num;
    });
    let result = knex('Workers').where('id',data.id).update(data);
    result.then(function(upd){
      let trans = knex('Transactions').where('account_id',original_id).update({account_id: data.id_num});
      trans.then(function(upd2){
        console.log('updated transaction information');
      });
      console.log('updated information for ' + data.id);


    });
  });



  // Reports
  async function getDailyReports() {
    let workers = knex.select("*").from('Workers').asCallback(function(err,rows){
      return rows;
    });
  }



  ipcMain.on('Reports.RequestOverall',async function(evt, raw){
    //Determine Type of report i.e. daily, weekly, month
    const data = await JSON.parse(raw);
    console.log('Requesting Overall Reports');
    var dateQuery;
    if(data.type == "daily") {
      dateQuery = "date('now')";
    }


    var currentDate = new Date().toISOString().slice(0,10);
    let result = await knex.select("*").from('Workers').asCallback(async function(err, rows){

      for(var i = 0; i < rows.length; i++) {
        var transaction_result;
        var transaction_result,payments_result;

          // Compute Transaction records
          if(data.type == "daily") {

            transaction_result = await knex.select("*").from('Transactions')
            .where(knex.raw("account_id = :account AND payment = 0 AND transaction_date >= date('now')",{
              account: rows[i].id_num,
            })).asCallback(async function(err, rows){

              return rows;
            });
          }
          else if(data.type == "preset"){

            transaction_result = await knex.select("*").from('Transactions')
            .where(knex.raw("account_id = :account AND payment = 0 AND transaction_date > date('now',:def)",{
              account: rows[i].id_num,
              def: data.def
            })).orderBy('transaction_date','desc').asCallback(async function(err, rows){
              return rows;
            });
          }
          else {
            transaction_result = await knex.select("*").from('Transactions')
            .where(knex.raw("account_id = :account AND payment = 0 AND transaction_date >= :startDate AND transaction_date <= :endDate",{
              account: rows[i].id_num,
              def: data.def,
              startDate: data.sDate,
              endDate: data.eDate
            })).orderBy('transaction_date','desc').asCallback(async function(err, rows){
              return rows;
            });
          }
          let total_transaction = await knex.sum("amount as total").from('Transactions').where('account_id',rows[i].id_num).andWhere('payment',0).asCallback(async function(err, result){
            return result[0].total;
          });
          rows[i].transactions = transaction_result;
          rows[i].totalT = total_transaction[0].total;

          // Compute Payment Records
          if(data.type == "daily") {
           payments_result = await knex.select("*").from('Transactions')
          .where(knex.raw("account_id = :account AND payment = 1 AND transaction_date >= date('now')",{
            account:rows[i].id_num
          })).asCallback(async function(err,rows){
            return rows;
          });
          }
          else if(data.type == "preset"){
            payments_result = await knex.select("*").from('Transactions')
            .where(knex.raw("account_id = :account AND payment = 1 AND transaction_date >=date('now', :def)",{
              account:rows[i].id_num,
              def: data.def
            })).orderBy('transaction_date','desc').asCallback(async function(err,rows){
              return rows;
            });
          }
          else {
            payments_result = await knex.select("*").from('Transactions')
            .where(knex.raw("account_id = :account AND payment = 1 AND transaction_date >= :startDate AND transaction_date <= :endDate",{
              account: rows[i].id_num,
              def: data.def,
              startDate: data.sDate,
              endDate: data.eDate
            })).orderBy('transaction_date','desc').asCallback(async function(err, rows){
              return rows;
            });
          }
          let total_payment = await knex.sum("amount as total").from('Transactions').where('account_id',rows[i].id_num).andWhere('payment',1).asCallback(async function(err, result){
            return result[0].total;
          });
          rows[i].payments = payments_result;
          rows[i].totalP = total_payment[0].total;



      }

      mainWindow.webContents.send('ReportsRecieve.Daily',rows);
      return rows;

    });

  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
app.on('window-all-closed', () => {
  app.quit();
});
