const fs = require("fs");
var _ = require("lodash");
const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

const readFileToArray = (path) => {
  return fs.readFileSync(path, "utf8").split("\n");
};

const writeFile = (path, data) => {
  fs.writeFileSync(path, data);
};

const rowsToArray = (arr) => {
  var result = [];
  if (arr) {
    arr.forEach((row, index) => {
      result[index] = _.split(row, /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
    });
  }
  return result;
};


const normalizeGroupsData = (groups) => {
  tmpGroups = [];

  groups.forEach((group) => {
    if (group.length > 0) {
      group = group.trim();
      tmpGroups = [...tmpGroups, group]; 
    }       
  });

  return tmpGroups;
}

const validateCsvRow = (dataHeaders, rowData) => {
  var result = {};
  result["groups"] = [];
  result["addresses"] = [];

  dataHeaders.forEach((header, index) => {    
    header = _.replace(header, /"/g, '')
    result[header] = rowData[index];

    if (header === "group") {
      splitedGroup = rowData[index].split(/,|\/|"/);

      
      result["groups"] = _.union(result["groups"], splitedGroup);

      result["groups"] = normalizeGroupsData(result["groups"]);
      
      delete result["group"];
    }

    if (_.startsWith(header, 'email') || _.startsWith(header, 'phone')){
      var addrs = {};
      var splitedHeader = _.split(header, ' ');

      addrs["type"] = splitedHeader[0];
      _.pull(splitedHeader, splitedHeader[0]);
      addrs["tags"] = splitedHeader;
              
      
      if( addrs["type"] === "phone" ){
        rowData[index] = rowData[index].replace(/[^\d\+]/g,"");
        if( rowData[index].length ){  
          const number = phoneUtil.parseAndKeepRawInput(rowData[index], 'BR');          
          if (phoneUtil.isValidNumberForRegion(number, 'BR')) {
            addrs["address"] = phoneUtil.format(number, PNF.E164);
            result["addresses"].push(addrs);
          }          
        }
      }   

      if( addrs["type"] === "email" ){       
      
        regex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;

        validEmails = rowData[index].match(regex);   

        if ( validEmails ) {            

          validEmails.forEach((email, i) => {
            var temp = {...addrs};
            temp["address"] = email;           
            result["addresses"].push(temp);             
          });          
          
        }  
      }           
      delete result[header];      
    }    
    
    if (['invisible', 'see_all'].includes(header)){      
      const trueValues = ['yes', '1'];
      if ( trueValues.includes(rowData[index]) ){
        result[header] = true;
      } else {
        result[header] = false;
      }            
    }   

  }); 

  return result;
};

const validateCsvData = (arr) => {

  const dataHeaders = arr[0];
  const dataRows = arr.slice(1, arr.length);
  var validatedData = new Array();
  
  dataRows.forEach((row, i) => {
    if (row.length == arr[0].length) {
      var validatedRow = validateCsvRow(dataHeaders, row);

      validatedData.push(validatedRow);      
    }        
  });

  return validatedData;
};

const mergeDuplicates = (validatedData) => { 
  
  mergedData = new Array();  

  validatedData.forEach((elem) => {
    
    var duplicated = mergedData.filter((curr) => {
      return curr.eid == elem.eid;
    });    

    if(duplicated.length) {
      var duplicatedIndex = mergedData.indexOf(duplicated[0]);      
      mergedData[duplicatedIndex].addresses = _.uniq(_.concat(mergedData[duplicatedIndex].addresses, elem.addresses));
      mergedData[duplicatedIndex].groups = _.uniq(_.concat(mergedData[duplicatedIndex].groups, elem.groups));      
    } else {
      mergedData.push(elem);
    }  
  });
  return mergedData; 
}

pathInput = "./input1.csv";
pathOutput = "./output1.json";

var dataArray = readFileToArray(pathInput);

dataArray = rowsToArray(dataArray);

dataArray = validateCsvData(dataArray);

dataArray = mergeDuplicates(dataArray);

writeFile(pathOutput, JSON.stringify(dataArray));

console.log("Script Finalizado.");
