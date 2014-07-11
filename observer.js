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

// Mozilla services
mozilla.observerService = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);
mozilla.protocolProxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"]
                                 .getService(Ci.nsIProtocolProxyService);
mozilla.thirdPartyUtil = Cc["@mozilla.org/thirdpartyutil;1"]
                           .getService(Ci.mozIThirdPartyUtil);
                          
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
    apply : function (aProxyService, aChannel, aProxy) {
      return filterFunction(aChannel, aProxy);
    }
  };
  mozilla.protocolProxyService.registerFilter(proxyFilter, positionIndex);
  return function () {
    mozilla.protocolProxyService.unregisterFilter(proxyFilter);
  };
};

// ## tor functionality.
var tor = tor || {};

tor.setChannelSocksPort = function (httpChannel, port) {
  var pi = mozilla.protocolProxyService.newProxyInfo("socks", "127.0.0.1", port, 1, 1800, null);
  httpChannel.QueryInterface(Ci.nsIProtocolProxyCallback).onProxyAvailable(null, null, pi, 0);
};

tor.getChannelSocksPort = function (httpChannel) {
  return httpChannel.QueryInterface(Ci.nsIProxiedChannel).proxyInfo.port;
};

// __tor.socksProxyInfoWithUsername__.
// Takes a proxyInfo object (originalProxy) and returns a new proxyInfo
// object with the same properties, except the username is set to the 
// second argument of this function.
tor.socksProxyInfoWithUsername = function (originalProxy, username) {
  var proxy = originalProxy.QueryInterface(Ci.nsIProxyInfo);
  return mozilla.protocolProxyService.newSOCKSProxyInfo(proxy.host, proxy.port,
                                                        username, "",
                                                        proxy.flags,
                                                        proxy.failoverTimeout,
                                                        proxy.failoverProxy);
};

// ## test functions.

var test = test || {};

// __test.proxy__.
// Tests the proxy filter functionality. Returns a function that de-registers the 
// proxy filter.
test.proxy = function () {
  return mozilla.registerProxyFilter(function (aChannel, aProxy) {
    var channel = aChannel.QueryInterface(Ci.nsIHttpChannel),
        firstPartyURI = mozilla.thirdPartyUtil.getFirstPartyURIFromChannel(channel, true).QueryInterface(Ci.nsIURI),
        firstPartyDomain = mozilla.thirdPartyUtil.getFirstPartyHostForIsolation(firstPartyURI),
        proxy = aProxy.QueryInterface(Ci.nsIProxyInfo),
        replacementProxy = tor.socksProxyInfoWithUsername(aProxy, firstPartyDomain);
    console.log("proxy filter", channel.URI.spec, firstPartyURI.spec, firstPartyDomain);
    console.log(replacementProxy.host, replacementProxy.port, replacementProxy.username, replacementProxy.password); 
    return replacementProxy;
  }, 0);
};

// __test.all__.
// Tests all callbacks. Returns a zero-arg function that de-registers the callbacks.
test.all = function () {
  var r1 = mozilla.observe("http-on-modify-request", function (subject, topic, data) { 
    var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
    var proxyInfo = subject.QueryInterface(Ci.nsIProxiedChannel).proxyInfo;
    //console.log(tor.getChannelSocksPort(httpChannel));
    console.log("http-on-modify-request", httpChannel.URI.spec, proxyInfo.host, proxyInfo.port, proxyInfo.username, proxyInfo.password);
  });
  var r2 = mozilla.observe("http-on-opening-request", function (subject, topic, data) { 
    var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
    console.log("http-on-opening-request", httpChannel.URI.spec);
    console.log(httpChannel.QueryInterface(Ci.nsIProxiedChannel).proxyInfo);
    //utils.logMembers(httpChannel.QueryInterface(Ci.nsIProxiedChannel).proxyInfo);
  });
  var r3 = test.proxy();
  return function () { r1(); r2(); r3(); };
};

