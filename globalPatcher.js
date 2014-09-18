/* jshint esnext:true */

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

let observerService = Cc["@mozilla.org/observer-service;1"]
                        .getService(Ci.nsIObserverService);

let addObserverFunction = function(observerFunction, notification) {
  let observer = {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
    observe: function (subject, topic, data) {
      if (topic === notification) {
        observerFunction(subject, data);
      }
    }
  };
  observerService.addObserver(observer, notification, false);
  return function () {
    observerService.removeObserver(observer, notification);
  };
};

let applyToContentGlobals = function (modificationFunction) {
  return addObserverFunction(function (subject, data) {
      if (subject instanceof Ci.nsIDOMWindow) {
        modificationFunction(XPCNativeWrapper.unwrap(subject));
      }
    }, "content-document-global-created");
};

/*
let fixDate = function (w) {
  let old_Date_toLocaleString = w.Date.prototype.toLocaleString;
  w.Date.prototype.toLocaleString = function () {
    console.log("Date.toLocaleString called");
    return old_Date_toLocaleString.apply(this, ["en-US"]);
  }
  console.log(old_Date_toLocaleString);
  console.log(w.document.URL);
};
*/

// Modify the behavior of Numbers in the given window with global
// object "w" so that toLocaleString without arguments always produces
// an "en" (English) format, regardless of the user's locale.
let fixNumber = function (w) {
  w.Number.prototype.toLocaleString = function () {
    args = arguments[0] ? arguments : ["en"];
    // We can't use old w.Number.prototype because Firefox complains
    // we can't access unwrapped object. So we use the chrome version.
    return Number.prototype.toLocaleString.apply(this, args);
  };
};

// Modify the behavior of Strings in the given window with global
// object "w" so that localeCompare without arguments always produces
// an "en" (English) format, regardless of the user's locale.
let fixString = function (w) {
  w.String.prototype.localeCompare = function (compareString, locales, options) {
    myLocales = locales || "en";
    // We can't use old w.Number.prototype because Firefox complains
    // we can't access unwrapped object. So we use the chrome version.
    return String.prototype.localeCompare.apply(this, [compareString, myLocales, options]);
  };
};

// Others needed: Intl.Collator, Intl.DateTimeFormat, Intl.NumberFormat, Array.toLocaleString

let cancel1 = applyToContentGlobals(fixNumber);
let cancel2 = applyToContentGlobals(fixString);

let cancel = () => { cancel1(); cancel2(); };
