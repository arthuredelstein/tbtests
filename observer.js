// ## Abbreviations
Cc = Components.classes;
Ci = Components.interfaces;

// ## utils namespace
var utils = utils || {};

// __utils.logMembers__.
// Logs "key" : "value" to the console for each owned property of obj.
utils.logMembers = function (obj) {
  Object.keys(obj).forEach(function (key) { console.log(key, ":", obj[key]); });
};

// ## mozilla namespace.
// Useful functionality for interacting with Mozilla services.
var mozilla = mozilla || {};

// Mozilla's services
mozilla.observerService = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);
mozilla.protocolProxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"]
                                 .getService(Ci.nsIProtocolProxyService);
                          
// __mozilla.observe__.
// Registers a callback with the Mozilla Observer Service,
// which will be dispatched by the trigger of a particular
// [observer topic](https://developer.mozilla.org/en-US/docs/Observer_Notifications#Observer_topics).
// The callback should expect three arguments: callback(subject, topic, data);
// Returns a zero-argument function that will unregister the callback.
mozilla.observe = function (observerTopic, callback) {
  var observer = {
    observe : function (subject, topic, data) {
      callback(subject, topic, data);
    }
  };
  mozilla.observerService.addObserver(observer, observerTopic, false);
  return function () {
    mozilla.observerService.removeObserver(observer, observerTopic);
  };
};

// __mozilla.registerProxyFilter__.
// Registers a proxy filter with the Mozilla Protocol Proxy Service,
// which will help to decide the proxy to be used for a given URI.
// The filterFunction should expect two arguments: filterFunction(aChannel, aProxy)
// where aProxy is the proxy or list of proxies that would be used by default
// for the given URI, and should return a new Proxy or list of Proxies.
// Returns a zero-argument function that will unregister the filter.
mozilla.registerProxyFilter = function (filterFunction, positionIndex) {
  var proxyFilter = {
    applyFilter : function (aProxyService, aChannel, aProxy) {
      return filterFunction(aURI, aProxy);
    }
  };
  mozilla.protocolProxyService.registerFilter(proxyFilter, positionIndex);
  return function () {
    mozilla.protocolProxyService.unregisterFilter(proxyFilter);
  };
};

var tor = tor || {};

tor.setChannelSocksPort = function(httpChannel, port) {
  var pi = mozilla.protocolProxyService.newProxyInfo("socks", "127.0.0.1", port, 1, 1800, null);
  httpChannel.QueryInterface(Ci.nsIProtocolProxyCallback).onProxyAvailable(null, null, pi, 0);
};

tor.getChannelSocksPort = function(httpChannel) {
  return httpChannel.QueryInterface(Ci.nsIProxiedChannel).proxyInfo.port;
};

// __runTest__.
// Tests the observer functionality for http-on-modify-request. Returns a zero-arg
// function that removes the observer.
var runTest = function () {
  var r1 = mozilla.observe("http-on-modify-request", function(subject, topic, data) { 
    var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
    console.log(getChannelSocksPort(httpChannel));
    console.log("http-on-modify-request", httpChannel.URI.spec);
  });
  var r2 = mozilla.observe("http-on-opening-request", function(subject, topic, data) { 
    var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
    console.log("http-on-opening-request", httpChannel.URI.spec);
    utils.logMembers(httpChannel.QueryInterface(Ci.nsIProxiedChannel).proxyInfo);
  });
  var r3 = mozilla.registerProxyFilter(function (aChannel, aProxy) {
    console.log("proxy filter", aChannel.QueryInterface(Ci.nsIHttpChannel).URI.spec);
    return aProxy;
  }, 0);
  return function () { r1(); r2(); r3(); };
};

var grabChannel = function () {
  var chan,
      cancelFunction = mozilla.registerProxyFilter(function (channel, proxy) { 
    chan = channel.QueryInterface(Ci.nsIHttpChannel);
    console.log("http-on-opening-request", chan.URI.spec);
  });
  return [chan, cancelFunction];
};
