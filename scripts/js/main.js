
// return exchange amount given exchange rate
function getExchangeValue(rate, ccy1Amt) {
	return ccy1Amt / (1 / rate);
}
// query exchange rate given a pair of currency set
function getExchangeRateAsync(ccy1, ccy2, callback) {
	var uri = "https://query.yahooapis.com/v1/public/yql?format=json&"; // yql query
	var env = "env=" + encodeURIComponent("store://datatables.org/alltableswithkeys");
	var parameter = ccy1 + ccy2;
	var query = "q=" + encodeURIComponent("SELECT Name, Rate, Date FROM yahoo.finance.xchange WHERE pair=\"" + parameter + "\""); 
	$.ajax({
		url: uri + env + "&" + query,
		success: function(response, status, xhr) {
			if (status == "success") callback(status, response);
		},
		error: function(xhr, status, error) {
			// this condition is most probable with no internet connection
			if (xhr.readyState == 0 && error == "") error = "Unabled to sent request to server. Please check internet connection!"; 
			callback(status, error);
		}
	});
}
$(document).ready(function() {
	var prevValues;
	var ccyCodes;
	var domDirection = $("#ccy-direction");
	var one = $($("input[name=ccy-input-one]")[0]);
	var two = $($("input[name=ccy-input-two]")[0]);
	var domSelectCcyOne = $("#ccy-select-one");
	var domSelectCcyTwo = $("#ccy-select-two");
	function hasChanged() {
		if (prevValues === undefined) return true;
		return !(one.val() == prevValues[0][0] && domSelectCcyOne.val() == prevValues[0][1] && two.val() == prevValues[1][0] && domSelectCcyTwo.val() == prevValues[1][1]);
	}
	var statusFadeoutTimer = new Timer(3000, function() {
		$("#ccy-meta").fadeOut();
	});
	var sumbitTimer = new Timer(1000, function(e) {
		var ccy1;
		var ccy2;
		var active;
		var passive;
		var isDownward = (e == one[0]);
		if (isDownward) {
			ccy1 = domSelectCcyOne;
			ccy2 = domSelectCcyTwo;
			active = one;
			passive = two;
			domDirection[0].className = "down";
		}
		else {
			ccy1 = domSelectCcyTwo;
			ccy2 = domSelectCcyOne;
			active = two;
			passive = one;
			domDirection[0].className = "up";
		}
		// remove input highlight
		active.removeClass("highlighted");
		passive.removeClass("highlighted");
		// show loader for the targeted input
		passive.parent().addClass("loader");
		getExchangeRateAsync(ccy1.val(), ccy2.val(), function(status, data) {
			passive.parent().removeClass("loader"); // hide loader
			if (status == "success") {
				data = data.query.results.rate;
				// show currency exchange information 
				$("#ccy-meta")
					.removeClass("red")
					.addClass("green")
					.fadeIn()
					.html("Rate for " + data.Name + " is <strong>" + data.Rate + "</strong><br>Last updated on " + data.Date);
				// update result in the targeted input
				passive.val(Math.ceil(getExchangeValue(data.Rate, active.val()) * 100) / 100);
				passive.get(0).className = "highlighted"; // highlight the targeted input
				statusFadeoutTimer.restart(8000); // fade out the currency exchange information in 8 seconds
				// record current values
				prevValues = [
					[Number(one.val()), domSelectCcyOne.val()],
					[Number(two.val()), domSelectCcyTwo.val()]
				];
			}
			else { 
				// show error information on failure
				$("#ccy-meta")
				.removeClass("green")
				.addClass("red")
				.fadeIn()
				.html("<strong>" + status + ":</strong> " + ((data != "") ? data : "unknown error!") + ".");
				statusFadeoutTimer.restart();
			}
		});
	});
	// call to retreive currency codes
	$.ajax({
		url: "assets/ISO4217ccycode_structured.json",
		success: function(response, status, xhr) {
			// get currency code
			ccyCodes = response.Currency.sort(function(a, b) { return a.Name > b.Name; });
			// populate select elements with currency codes
			for (var i = 0; i < ccyCodes.length; i++) {
				var ccyN = ccyCodes[i];
				var select = $(".currency-code-select");
				// loop through every select dom
				for (var j = 0; j < select.length; j++) {
					if (typeof(ccyN.Name) != "object")
						$("<option value='" + ccyN.Code + "'>" + ccyN.Name + " [" + ccyN.Code + "]</option>").appendTo($(select[j]));
				}
			}
			// load currency selection store
			if (window.Storage) {
				if (localStorage["ccy-first"] != undefined) domSelectCcyOne.val(localStorage["ccy-first"]);
				else domSelectCcyOne.val("USD");
				if (localStorage["ccy-second"]) domSelectCcyTwo.val(localStorage["ccy-second"]);
				else domSelectCcyTwo.val("CNY");
			}
			else {
				// set default selection value if no store available
				domSelectCcyOne.val("USD");
				domSelectCcyTwo.val("CNY");
			}
			// manually force select to update
			domSelectCcyTwo.trigger("change");
			domSelectCcyOne.trigger("change");
		}
	});
	var onInputKeyChange = function(e) {
		if (!this.checkValidity()) { 
			e.preventDefault();
			sumbitTimer.stop();
			return;
		}
		else sendRequest(this);
	};
	one.keyup(onInputKeyChange);
	two.keyup(onInputKeyChange);
	var onSelectChange = function(e) {
		// save the selection to local storage
		if (window.Storage) {
			localStorage["ccy-" + ((this == domSelectCcyOne[0]) ? "first" : "second")] = this.value;
		}
		// display countries the selected currency is used
		var ccy = this.value;
		var ctries = ccyCodes[ccyCodes.findIndex(function(s) {return s.Code == ccy;})].Countries.join("<br>");
		$(this).next().html("<strong>Used in the following Countries:</strong><hr>" + ctries);
		// perform request
		if (this == domSelectCcyOne[0]) sendRequest(one);
		else sendRequest(two);

	};
	domSelectCcyOne.change(onSelectChange);
	domSelectCcyTwo.change(onSelectChange);
	function sendRequest(sender) {
		if (sender.jquery) sender = sender[0];
		// check to see if values have been changed to determine if sending request to the server is needed
		if (hasChanged()) {
			sumbitTimer.extra = sender;
			sumbitTimer.restart();
		}
	}
});
function Timer(interval, f) {
	this.interval = interval;
	this.function = f;
	var base = this;
	this.extra;
	this.restart = function(interval) {
		this.stop();
		this.timer = setTimeout(function() { base.function(base.extra); }, (interval) ? interval : this.interval); 
	};
	this.stop = function() {
		if (this.timer) clearTimeout(this.timer);
	};
}