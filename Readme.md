# Volcan

[Node][] library for remote debugging Firfox. It generates all of the client out of the functionality present on the firefox it connects to. Library has more of DOM API feel to rather than idomatic node, because it was originally designed for firefox add-ons SDK but made compatible with nodejs.


## Usage


```js
var volcan = require("volcan");

spawn(function*() {
  var root = yield volcan.connect(8060, "localhost");
  assert("hello" === yield root.echo("hello"));
  var list = yield root.listTabs();

  console.log("You have " + list.tabs.length + " open tabs");

  var activeTab = list.tabs[list.selected];

  console.log("Your active tab url is: " + activeTab.url);

  var sheets = yield activeTab.styleSheetsActor.getStyleSheets();

  console.log("Page in active tab has " + sheets.length + " stylesheets");

  yield sheets[0].toggleDisabled(); // => true

  console.log("First stylesheet was disabled!");

  // ...
});
```


[node]:http://nodejs.org/