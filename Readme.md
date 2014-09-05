# Volcan

[Node][] library for remote debugging Firefox. It generates all of the client out of the functionality present on the firefox it connects to. Library has more of DOM API feel to rather than idomatic node, because it was originally designed for firefox add-ons SDK but made compatible with nodejs.


## Usage


```js
var volcan = require("volcan");
var Port = require("volcan/port");

// In case of node.js you would create connection to a firefox
// using tcp port. In case of firefox add-on you will be given
// equivalent port instance.
var port = new Port(8060, "localhost");

spawn(function*() {
  var root = yield volcan.connect(port);
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
