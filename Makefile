BROWSERIFY = node ./node_modules/browserify/bin/cmd.js

clean:
	rm -f volcan.js
	$(BROWSERIFY) -r ./browser/index.js -d -s volcan > volcan.js
