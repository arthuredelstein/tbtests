// ## Abbreviations
Cc = Components.classes;
Ci = Components.interfaces;

// ## mozilla namespace.
// Useful functionality for interacting with Mozilla services.
var mozilla = mozilla || {};

// __mozilla.protocolProxyService__.
// Mozilla's protocol proxy service, useful for managing proxy connections made
// by the browser.
mozilla.protocolProxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"]
                                 .getService(Ci.nsIProtocolProxyService);
// __mozilla.thirdPartyUtil__.
// Mozilla's Thirdy Party Utilities, for figuring out first party domain.
mozilla.thirdPartyUtil = Cc["@mozilla.org/thirdpartyutil;1"]
                           .getService(Ci.mozIThirdPartyUtil);
                           
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

// __tor.noncesForDomains__.
// A mutable map that records what nonce we are using for each domain.
tor.noncesForDomains = {};

// __tor.socksProxyCredentials.
// Takes a proxyInfo object (originalProxy) and returns a new proxyInfo
// object with the same properties, except the username is set to the 
// the domain, and the password is a nonce.
tor.socksProxyCredentials = function (originalProxy, domain) {
  // Check if we already have a nonce. If not, create
  // one for this domain.
  if (!tor.noncesForDomains.hasOwnProperty(domain)) {
    tor.noncesForDomains[domain] = 0;
  }
  var proxy = originalProxy.QueryInterface(Ci.nsIProxyInfo);
  return mozilla.protocolProxyService
           .newSOCKSProxyInfo(proxy.host,
            		          proxy.port,
            		          username,
            		          tor.noncesForDomains[domain].toString(),
            		          proxy.flags,
            		          proxy.failoverTimeout,
            		          proxy.failoverProxy);
};

// __tor.isolateCircuitsByDomain__.
// For every HTTPChannel, replaces the default SOCKS proxy with one that authenticates
// to the SOCKS server (the tor client process) with a username (the first party domain)
// and a nonce password.
tor.proxy = function () {
  return mozilla.registerProxyFilter(function (aChannel, aProxy) {
    var channel = aChannel.QueryInterface(Ci.nsIHttpChannel),
        firstPartyURI = mozilla.thirdPartyUtil.getFirstPartyURIFromChannel(channel, true).QueryInterface(Ci.nsIURI),
        firstPartyDomain = mozilla.thirdPartyUtil.getFirstPartyHostForIsolation(firstPartyURI),
        proxy = aProxy.QueryInterface(Ci.nsIProxyInfo),
        replacementProxy = tor.socksProxyCredentials(aProxy, firstPartyDomain);
    console.log("tor:", channel.URI.spec, replacementProxy.host, replacementProxy.port, replacementProxy.username, replacementProxy.password); 
    return replacementProxy;
  }, 0);
};

