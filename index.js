const fs = require("fs");
var _ = require("lodash");
const PNF = require("google-libphonenumber").PhoneNumberFormat;
const phoneUtil =
  require("google-libphonenumber").PhoneNumberUtil.getInstance();

const splitFileOnRowsArrays = (path) => {
  return fs.readFileSync(path, "utf8").split("\n");
};

const writeFile = (path, data) => {
  fs.writeFileSync(path, data);
};

const splitRowsByCommas = (arr) => {
  var result = new Array();
  const regex = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;
  if (arr) {
    arr.forEach((row, index) => {
      result[index] = _.split(row, regex);
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
};

const combineGroupsData = (resultArray, currGroups) => {
  const regex = /,|\/|"/;
  var splitedGroups = currGroups.split(regex);
  resultArray["groups"] = _.union(resultArray["groups"], splitedGroups);
  resultArray["groups"] = normalizeGroupsData(resultArray["groups"]);
  delete resultArray["group"];
};

const removeQuotesFromHeader = (header) => {
  const regex = /"/g;
  return _.replace(header, regex, "").trim();
};

const splitHeaderTags = (header) => {
  var addrs = new Object();
  var splitedHeader = _.split(header, " ");
  addrs["type"] = splitedHeader[0];
  _.pull(splitedHeader, splitedHeader[0]);
  addrs["tags"] = splitedHeader;
  return addrs;
};

const removeCaracteresFromPhone = (number) => {
  const regex = /[^\d\+]/g;
  return number.replace(regex, "");
};

const normalizeBooleanValues = (resultArr, header, data) => {
  const trueValues = ["yes", "1"]; 
  resultArr[header] = trueValues.includes(data.trim());  
};

const validateCsvRowData = (dataHeaders, rowData) => {
  var result = {};
  result["groups"] = [];
  result["addresses"] = [];

  dataHeaders.forEach((header, index) => {
    header = removeQuotesFromHeader(header);

    result[header] = rowData[index];

    if (header === "group") {
      combineGroupsData(result, rowData[index]);
      result["groups"] = normalizeGroupsData(result["groups"]);
    }

    if (_.startsWith(header, "phone")) {
      var addrs = splitHeaderTags(header);
      rowData[index] = removeCaracteresFromPhone(rowData[index]);

      if (rowData[index].length) {
        const number = phoneUtil.parseAndKeepRawInput(rowData[index], "BR");
        if (phoneUtil.isValidNumberForRegion(number, "BR")) {
          addrs["address"] = phoneUtil
            .format(number, PNF.E164)
            .replace("+", "");
          result["addresses"].push(addrs);
        }
      }
      delete result[header];
    }

    if (_.startsWith(header, "email")) {
      var addrs = splitHeaderTags(header);
      regex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
      validEmails = rowData[index].match(regex);
      if (validEmails) {
        validEmails.forEach((email) => {
          var temp = { ...addrs };
          temp["address"] = email;
          result["addresses"].push(temp);
        });
      }
      delete result[header];
    }
    if (["invisible", "see_all"].includes(header)) {      
      normalizeBooleanValues(result, header, rowData[index]);
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
      var validatedRow = validateCsvRowData(dataHeaders, row);
      validatedData.push(validatedRow);
    }
  });
  return validatedData;
};

const mergeDuplicateIds = (validatedData) => {
  mergedData = new Array();
  validatedData.forEach((elem) => {
    var duplicated = mergedData.filter((curr) => {
      return curr.eid == elem.eid;
    });

    if (duplicated.length) {
      var duplicatedIndex = mergedData.indexOf(duplicated[0]);
      mergedData[duplicatedIndex].addresses = _.uniq(
        _.concat(mergedData[duplicatedIndex].addresses, elem.addresses)
      );
      mergedData[duplicatedIndex].groups = _.uniq(
        _.concat(mergedData[duplicatedIndex].groups, elem.groups)
      );
    } else {
      mergedData.push(elem);
    }
  });
  return mergedData;
};

pathInput = "./input.csv";
pathOutput = "./output.json";
var resultArray = splitFileOnRowsArrays(pathInput);
resultArray = splitRowsByCommas(resultArray);
resultArray = validateCsvData(resultArray);
resultArray = mergeDuplicateIds(resultArray);
writeFile(pathOutput, JSON.stringify(resultArray, null, 4));
