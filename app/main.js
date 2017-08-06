var app = angular.module('canteen-app', ['ngRoute','chart.js']);
const electron = require("electron");
const remote = require("electron").remote;
const ipc = electron.ipcRenderer;
/*
document.addEventListener("DOMContentLoaded",function(){
  ipc.send("mainWindowLoaded");
  ipc.on("resultSent", function(evt, result){
    let resultEl = document.getElementById("result");
    console.log(result);
    for(var i = 0; i < result.length; i++) {
      resultEl.innerHTML += "First name: " + result[i].first_name.toString() + " <br/>";
    }
  });
});
*/
const currentDate = new Date().toISOString().slice(0,10);
var activeUser;
app.directive('ngConfirmClick', [
    function() {
        return {
            link: function (scope, element, attr) {
                var msg = attr.ngConfirmClick || "Are you sure?";
                var clickAction = attr.confirmedClick;
                element.bind('click',function (event) {
                    if (window.confirm(msg)) {
                        scope.$eval(clickAction)
                    }
                });
            }
        };
    }
]);

app.config(['$routeProvider','$locationProvider',
function config($routeProvider,$locationProvider){
  $routeProvider
  .when('/',{
    templateUrl: 'home.html',
    controller: 'HomeController'
  })
  .when('/transactions/:userid*?',{
    templateUrl: 'transactions.html',
    controller: 'TransactionsController'
  })
  .when('/workers',{
    templateUrl: 'workers.html',
    controller: 'WorkersController'
  })
  .when('/workers/:id',{
    templateUrl: 'worker.html',
    controller: 'SingleWorkerController'
  })
  .when('/reports',{
    templateUrl: 'reports/overall.html',
    controller: 'ReportsController'
  })
  .when('/exit', {
    templateUrl: 'exit.html',
    controller: 'ExitController'
  })
}]);
app.filter('searchForClient',function(){
  return function(arr, searchString){

		if(!searchString){
			return arr;
		}

		var result = [];

		searchString = searchString.toLowerCase();

    if(searchString.length > 0) {
      // Using the forEach helper method to loop through the array
  		angular.forEach(arr, function(item){
        var fullname = item.last_name + " " +item.first_name;
  			if(fullname.toLowerCase().indexOf(searchString) !== -1){
  				result.push(item);
  			}
        else if(item.id_num == searchString) {
          result.push(item);
        }

  		});
    }


		return result;
	};
});
// Search filter
app.filter('searchFor', function(){

	// All filters must return a function. The first parameter
	// is the data that is to be filtered, and the second is an
	// argument that may be passed with a colon (searchFor:searchString)

	return function(arr, searchString){

		if(!searchString){
			return arr;
		}

		var result = [];

		searchString = searchString.toLowerCase();

    if(searchString.length > 0) {
      // Using the forEach helper method to loop through the array
  		angular.forEach(arr, function(item){

  			if(item.full_name.toLowerCase().indexOf(searchString) !== -1){
  				result.push(item);
  			}
        else if(item.id_num == searchString) {
          result.push(item);
        }

  		});
    }


		return result;
	};

});
app.factory('Excel',function($window){
        var uri='data:application/vnd.ms-excel;base64,',
            template='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>{table}</table></body></html>',
            base64=function(s){return $window.btoa(unescape(encodeURIComponent(s)));},
            format=function(s,c){return s.replace(/{(\w+)}/g,function(m,p){return c[p];})};
        return {
            tableToExcel:function(tableId,worksheetName){
                var table=$(tableId),
                    ctx={worksheet:worksheetName,table:table.html()},
                    href=uri+base64(format(template,ctx));
                return href;
            }
        };
    })
app.controller('TransactionsController',function($scope,$routeParams){


$scope.workers = [];
$scope.recentWorkers = [];
$scope.customer = null;
$scope.activeUser = null;
$scope.transactioninput = {}
$scope.transactioninput.balance = 0;
$scope.transactioninput.payment = 0;
$scope.transactioninput.totalbalance = 0;
$scope.transactioninput.date = currentDate;
if(typeof($routeParams.userid) !== 'undefined' && $routeParams.userid !== "") {
  ipc.send('transaction.loadDefaultUser',$routeParams.userid)
}
ipc.send('requestWorkerList');
ipc.on('transaction.loadDefaultUser',function(evt,result){
  var worker = {
    'full_name': result.first_name + " " + result.last_name,
    'id_num': result.id_num,
    'db':result
  }
  $scope.setActiveCustomer(worker);
});
ipc.on('duplicateCustomerID',function(){
  alert('Duplicate customer id found in database. Please change ID number to a unique ID number.');
});
ipc.on('workerListResponse',function (evt, result){
  for(var i = 0; i < result.length; i++) {
    var worker = {
      'full_name': result[i].first_name + " " + result[i].last_name,
      'id_num': result[i].id_num,
      'db':result[i]
    }
    $scope.workers.push(worker);

    worker = {};
  }

});

  $scope.$on('$routeChangeSuccess', function () {
    ipc.send('mainWindowLoaded');
    ipc.on("resultSent", function(evt, result){
      let resultEl = document.getElementById("result");
      console.log(result);

    });
  });
$scope.clearSearch = function() {
  $scope.recentWorkers = [];
  $scope.$apply();
}
$scope.setActiveCustomer = function(i) {
  ipc.send('requestCustomerDetails',JSON.stringify(i.db));
  $scope.activeUser = i;
  $scope.customer = i;
  $scope.searchString = "";
  var pushTo = true;

    angular.forEach($scope.recentWorkers,function(item, key){
      if(item.id_num == i.id_num) {
        pushTo = false;
      }
    });
    if(pushTo) {
      $scope.recentWorkers.push(i);
    }



  $scope.$apply();
}

$scope.transactionSubmit = function(type) {
  // Submit a new transaction
  var senddata ={user: $scope.activeUser.db, amount: $scope.transactioninput.transaction, payment: type};
  if(type == 1){
    senddata.amount = $scope.transactioninput.paymentamt;
  }
  ipc.send('transactionSubmit',JSON.stringify(senddata));
  $scope.transactioninput.transaction = "";
  $scope.transactioninput.paymentamt = "";
  $scope.$apply();
}

$scope.deleteTransaction = function(tid) {
  var data = JSON.stringify({client: $scope.activeUser.db, transactionid: tid});
  ipc.send('deleteTransaction',data);

}

ipc.on("customerDetailsResponse",function(evt, result){
  $scope.transactions = result;
  var totalDebt = 0;
  var totalPayment = 0;
  var credit = 0;
  var totalbalance = 0;
  angular.forEach($scope.transactions,function(item){
    if(item.payment == 0) {
      totalDebt += item.amount;
      totalbalance += item.amount;
    }
    else {
      totalDebt -= item.amount;
      totalPayment += item.amount;
    }
  });
  if(totalDebt < 0) {
    credit = totalDebt * -1;
    totalDebt = 0;
  }
  $scope.transactioninput.totalbalance = totalbalance;
  $scope.transactioninput.balance = totalDebt;
  $scope.transactioninput.paid = totalPayment;
  $scope.transactioninput.credit = credit;
  $scope.$apply();
});

});

app.controller('WorkersController',function($scope){
  ipc.send('requestWorkerList');
  $scope.workers = [];
  $scope.clientform = {};
  ipc.on('workerListResponse',function (evt, result){
    $scope.workers = [];
    for(var i = 0; i < result.length; i++) {
      $scope.workers.push(result[i]);
    }
    $scope.$apply();
  });

  $scope.CreateClient = function() {
    ipc.send('createClientRequest',JSON.stringify({
      first_name: $scope.clientform.first_name,
      last_name: $scope.clientform.last_name,
      id_num: $scope.clientform.id_num
    })
  );
    $scope.clientform.first_name = "";
    $scope.clientform.last_name = "";
    $scope.clientform.id_num = "";
  }

  $scope.deleteClientRequest = function(id) {
    ipc.send('deleteClientRequest',id);
  }
});

app.controller('SingleWorkerController',function($scope,$routeParams){
  $scope.userid = $routeParams.id;
  console.log('Requesting ID: ' + $scope.userid);
  ipc.send('requestWorkerInfo',$scope.userid);
  $scope.client = {};
  $scope.transactions = [];
  ipc.on('recieveWorkerInfo',function(evt, result){
    $scope.client = result.user;
    $scope.transactions = result.transactions;
    $scope.$apply();
  });

  $scope.UpdateClientInfo = function() {
    ipc.send('UpdateClientInfo',JSON.stringify($scope.client));
    alert('Information Updated');
  }
});

app.controller('ReportsController',function($scope,Excel,$timeout){

  $scope.transactions = 0;
  $scope.deficit = 0;
  $scope.currentDate = currentDate;
  $scope.reportDate = $scope.currentDate;
  $scope.sales = 0;
  $scope.reportview = "overall";
  $scope.reports;
  $scope.searchDates = false;
  $scope.reportDateStart = "";
  $scope.reportDateEnd = "";

  var clearScopeTransactions = function() {
    $scope.transactions = 0;
    $scope.sales = 0;
    $scope.deficit = 0;
    $scope.reports = [];
  }
  $scope.searchDatesS = function() { // Search Specific Dates
    var oneDay = 24*60*60*1000;
    if($scope.reportDateStart == "") {
      alert("You need to specify a start date");
      return;
    }

    if($scope.reportDateEnd == "") {
      alert('You need to specify an end date');
      return;
    }

    if($scope.reportDateStart == $scope.reportDateEnd) {
      alert('Report End Date can not be the same as report start date');
      return;
    }

    var startDate = new Date($scope.reportDateStart);
    var endDate = new Date($scope.reportDateEnd);

    if(startDate > endDate) {
      alert('Start date can not be less than end date');
      return;
    }
    var daysBetween = Math.round(Math.abs((startDate.getTime() - endDate.getTime())/(oneDay)));
    var obj = {type: 'dates', def: '-'+daysBetween+' day', sDate: startDate, eDate:endDate};
    ipc.send('Reports.RequestOverall', JSON.stringify(obj));
    $scope.searchDates = false;
    $scope.reportDate = obj
  }
  $scope.changeReportDate = function(identifier) {
    // If user wants to specify specific search dates
    if(identifier == 'dates') {
      if($scope.searchDates)
        $scope.searchDates = false;
      else
        $scope.searchDates = true;

      $scope.$apply();
    }
    // If search dates are from the system options
    else {
      if(identifier == 'today') {
        var statisticsData = {type:'daily',def:'now'};
        ipc.send('Reports.RequestOverall',JSON.stringify(statisticsData));
        $scope.reportDate = currentDate;
      }
      else {
        var statisticsData = {type:'preset',def:identifier};
        ipc.send('Reports.RequestOverall',JSON.stringify(statisticsData));
        $scope.reportDate = statisticsData;
      }
    }

  }
  $scope.changeView = function(type) {
    $scope.reportview = type;
    $scope.$apply();
  }
  ipc.send('Reports.RequestOverall',JSON.stringify({type:'daily',def:'now'}));

  $scope.exportToExcel=function(tableId){ // ex: '#my-table'
  var exportHref=Excel.tableToExcel(tableId,'WireWorkbenchDataExport');
          $timeout(function(){location.href=exportHref;},100);
  }
  ipc.on('ReportsRecieve.Daily',function(evt, reports){
    clearScopeTransactions();
    $scope.reports = reports;
    angular.forEach($scope.reports,function(report,index){
      var transact_sum = 0;
      var payment_sum = 0;
      $scope.reports[index].transaction_total = 0;
      $scope.reports[index].payment_total = 0;

      angular.forEach(report.transactions,function(transaction){
        $scope.reports[index].transaction_total += transaction.amount;
        $scope.transactions += transaction.amount;
        transact_sum += transaction.amount;
      });

      angular.forEach(report.payments,function(payment){
        $scope.reports[index].payment_total += payment.amount;
        $scope.sales += payment.amount;
        payment_sum += payment.amount;
      });
      $scope.reports[index].transaction_sum = transact_sum;
      $scope.reports[index].payment_sum = payment_sum;
      $scope.reports[index].credit = 0;
      $scope.reports[index].balance = 0;

      if($scope.reports[index].totalT > $scope.reports[index].totalP) {
        $scope.reports[index].balance = $scope.reports[index].totalT - $scope.reports[index].totalP;
      }
      else {
        $scope.reports[index].credit = $scope.reports[index].totalP - $scope.reports[index].totalT;
      }

    });
    console.log($scope.reports);

    $scope.$apply();
  });
});

app.controller('ExitController',function($scope){
  var window = remote.getCurrentWindow();
  window.close();
});

app.controller('HomeController',function($scope){
  $scope.transactions = [];
  $scope.clients = [];
  $scope.total_transactions = [];
  $scope.transactions_data = {};
  $scope.transactions_chart = {};
  $scope.transactions_chart.series =['Transaction Flow']
  $scope.transactions_chart.datasetoverride = [
    {yAxisID: 'y-axis-1'}
  ];

  ipc.send('RequestHomeStats');

  ipc.on('HomeStats',function(evt, data){

    $scope.transactions = data.transactions;
    $scope.clients = data.clients;
    $scope.total_transactions = data.total_transactions;

    $scope.transactions_chart.labels = [];
    $scope.transactions_chart.data = [];

    var transdata = [];
    var chartdata = [];
    var minTransact = 0;
    var maxTransact = 0;
    angular.forEach($scope.total_transactions,function(item){
      var date = item.transaction_date;
        if(typeof transdata[date] === 'undefined') {
          transdata[date] = 0;
        }

        transdata[date] += item.amount;

    });
    for(var item in transdata) {
      if(minTransact == 0) {
        minTransact = transdata[item];
      }
      else {
        if(minTransact > transdata[item]) {
          minTransact = transdata[item];
          console.log('Min Transact: ' + minTransact);
        }
      }
      if(maxTransact == 0) {
        maxTransact = transdata[item];
      }
      else {
        if(maxTransact < transdata[item]) {
          maxTransact = transdata[item];
          console.log('Max Transact: ' + maxTransact);
        }
      }
      $scope.transactions_chart.labels.push(item);
      $scope.transactions_chart.data.push(transdata[item]);
    }
    $scope.transactions_chart.optionsData = {

        title : {
          display:true,
          text: 'Transactions Data'
        },
        scales: {
          yAxes: [
            {
              id: 'y-axis-1',
              type: 'linear',
              display: true,
              fill:false,
              ticks: {
                min: minTransact,
                max: maxTransact,
                beginAtZero:true,
                callback: function(value, index, values) {
                if(parseInt(value) >= 1){
                  return 'Php ' + value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                } else {
                  return 'Php ' + value;
                }
              }
              },
              position: 'left'
            },

          ]
        }

    };
    $scope.$apply();
  });
});
