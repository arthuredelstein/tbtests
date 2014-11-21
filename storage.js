var show = function (value) {
  document.getElementById("result").innerHTML = value;
};

var stored = window.localStorage.getItem("test");
if (!stored) {
  var newValue = new Date().toString();
  window.localStorage.setItem("test", newValue);
  show("Set value to: " + newValue);
} else {
  show("Found value: " +stored);
}
