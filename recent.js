
var isAddressPage = true;
var pageType = 'recent';
{
	// shorthands
	var _delta = bundle.DeltaBalances;
	var _util = bundle.utility;

	// initiation
	var initiated = false;
	var autoStart = false;

	var requestID = 0;

	// loading states
	var table2Loaded = false;
	var recentTable = undefined;


	var loadedCustom = false;
	var trigger_1 = false;
	var trigger_2 = false;
	var running = false;

	var etherscanFallback = false;

	// settings
	var decimals = false;
	var fixedDecimals = 3;
	var remember = false;

	var showTransactions = true;

	var blockDates = {};

	var transLoaded = 0;

	// user input & data
	/* publicAddr, savedAddr, metamaskAddr  moved to user.js */
	var lastResult2 = undefined;

	// config
	var tokenCount = 0; //auto loaded
	var blocktime = 14;
	var blocknum = -1;
	var startblock = 0;
	var endblock = 'latest';
	var transactionDays = 5;
	var useDaySelector = true;

	var displayFilter = {
		'Maker trade': 1,
		'Taker trade': 1,
		Deposit: 1,
		Withdraw: 1,
		Cancel: 0,
		'Wrap Token': 1,
		'Unwrap Token': 1,
		Approve: 0,
		Transfer: 1
	}

	// placeholder
	var transactionsPlaceholder = [
		{
			Status: true,
			Type: 'Deposit',
			Exchange: 'Placeholder',
			Token: getEther(),
			Amount: 0,
			Price: '',
			Base: getEther(),
			Total: 0,
			Hash: '0xH4SH',
			Date: _util.toDateTimeNow(),
			Info: window.location.origin + window.location.pathname + '/../tx.html#',
		}
	];


	// return token boject for ETH
	function getEther() {
		return _delta.uniqueTokens[_delta.config.ethAddr];
	}

	init();

	$(document).ready(function () {
		readyInit();
	});

	function init() {

		getBlockStorage();

		// borrow some ED code for compatibility
		_delta.startDeltaBalances(false, () => {
			if (!autoStart) {
				if (blocknum > -1) {
					startblock = getStartBlock();
				}
				else {
					_util.blockNumber(_delta.web3, (err, num) => {
						if (!err && num) {
							blocknum = num;
							startblock = getStartBlock();
						}
					});
				}
			}

			_delta.initTokens(true);

			initiated = true;
			if (autoStart)
				myClick();
		});
	}

	function readyInit() {

		//get metamask address as possbile input (if available)
		requestMetamask(false);

		getStorage();

		$('#decimals').prop('checked', decimals);
		checkDecimal();

		// detect enter & keypresses in input
		$('#address').keypress(function (e) {
			if (e.keyCode == 13) {
				myClick();
				return false;
			} else {
				hideError();
				return true;
			}
		});

		fillMonthSelect();
		let daysDisabled = $('#days').prop('disabled');
		if (!daysDisabled)
			setDaySelector();
		else
			setMonthSelector();

		$(window).resize(function () {
			hidePopovers();
		});

		//dismiss popovers on click outside
		$('body').on('click', function (e) {
			$('[data-toggle="popover"]').each(function () {
				//the 'is' for buttons that trigger popups
				//the 'has' for icons within a button that triggers a popup
				if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
					hidePopover(this);
				}
			});
			if (!$('#refreshButtonSearch').is(e.target)) {
				hideError();
			}
		});

		$('#typesDropdown').on('changed.bs.select', function (e) {
			//  $('#typesDropdown').on('hidden.bs.select', function (e) {
			var selected = []
			selected = $('#typesDropdown').val()

			// array of exchange names
			setTimeout(function () {
				toggleFilter(selected);
			}, 100);

		});

		//set types dropdown
		let dropdownVal = [];
		let displFilt = Object.keys(displayFilter);
		for (let i = 0; i < displFilt.length; i++) {
			let displ = displayFilter[displFilt[i]];
			if (displ) {
				dropdownVal.push(displFilt[i]);
			}
		}
		$('#typesDropdown').selectpicker('val', dropdownVal);

		placeholderTable();

		// url hash #0x..
		var addr = '';
		if (!addr) {
			var hash = window.location.hash;  // url parameter /#0x...
			if (hash)
				addr = hash.slice(1);
		}
		if (addr) {
			addr = getAddress(addr);
			if (addr) {
				publicAddr = addr;
				autoStart = true;
				// auto start loading
				myClick();
			}
		}
		else if (publicAddr) {
			autoStart = true;
			myClick();
		} else if (savedAddr) {//autoload when remember is active
			autoStart = true;
			// auto start loading
			loadSaved();
		} else if (metamaskAddr) {
			autoStart = true;
			loadMetamask();
		}
		else if (!addr && !publicAddr) {
			$('#userToggle').addClass('hidden');
			$('#address').focus();
		}
		if (autoStart && !initiated) {
			showLoading(true);
			if (table2Loaded && recentTable) {
				recentTable.clear().draw();
			}
		}
	}

	// more decimals checbox
	var changedDecimals = false;
	function checkDecimal() {
		changedDecimals = true;
		decimals = $('#decimals').prop('checked');
		setStorage();
		fixedDecimals = decimals ? 8 : 3;

		if (lastResult2) {
			makeTable2(lastResult2);
		} else {
			placeholderTable();
		}
		changedDecimals = false;
	}



	function toggleFilter(selected, dontSave) {

		let changed = false;
		let displFilt = Object.keys(displayFilter);
		for (let i = 0; i < displFilt.length; i++) {

			let enabled = 0;
			if (selected.length > 0 && selected.indexOf(displFilt[i]) !== -1) {
				enabled = 1;
			}
			if (displayFilter[displFilt[i]] !== enabled) {
				displayFilter[displFilt[i]] = enabled;
				changed = true;
			}
		}

		if (changed) {
			if (lastResult2) {
				makeTable2(lastResult2);
			} else {
				placeholderTable();
			}

			if (!dontSave)
				setStorage();
		}
	}

	function checkFilter(transType) {
		if (transType) {
			if (transType.indexOf('Maker') !== -1 || transType == 'Buy offer' || transType == 'Sell offer') {
				return displayFilter['Maker trade'];
			} else if (transType.indexOf('Taker') !== -1 || transType.indexOf('up to') !== -1 || transType == 'Trade') {
				return displayFilter['Taker trade'];
			}
			else if (transType === 'Deposit' || transType === 'Add Liquidity') {
				return displayFilter.Deposit;
			}
			else if (transType === 'Withdraw' || transType === 'Remove Liquidity') {
				return displayFilter.Withdraw;
			}
			else if (transType.indexOf('Cancel') !== -1) {
				return displayFilter.Cancel;
			}
			else if (transType.indexOf('Wrap') !== -1) {
				return displayFilter['Wrap Token'];
			}
			else if (transType.indexOf('Unwrap') !== -1) {
				return displayFilter['Unwrap Token'];
			}
			else if (transType === 'Approve') {
				return displayFilter.Approve;
			}
			else if (transType === 'In' || transType === 'Out' || transType.indexOf('Transfer') !== -1) {
				return displayFilter.Transfer;
			}
			else {
				return true;
			}
		} else {
			return false;
		}
	}

	function disableInput(disable) {
		$('#refreshButton').prop('disabled', disable);
		// $("#address").prop("disabled", disable);
		$('#loadingTransactions2').addClass('dim');
		$("#loadingTransactions2").prop("disabled", disable);

	}

	function showLoading(trans) {
		if (trans) {
			$('#loadingTransactions2').addClass('fa-spin');
			$('#loadingTransactions2').addClass('dim');
			$('#loadingTransactions2').prop('disabled', true);
			$('#loadingTransactions2').show();
			$('#refreshButtonLoading').show();
			$('#refreshButtonSearch').hide();
		}
		else if (!trans) {
			$('#refreshButtonLoading').hide();
			$('#refreshButtonSearch').show();
		}
	}

	function buttonLoading(trans) {
		if (!publicAddr) {
			hideLoading(trans);
			return;
		}
		if (trans) {
			$('#loadingTransactions2').removeClass('fa-spin');
			$('#loadingTransactions2').removeClass('dim');
			$('#loadingTransactions2').prop('disabled', false);
			$('#loadingTransactions2').show();
			//	$('#refreshButtonLoading').show();
			//	$('#refreshButtonSearch').hide();
			$('#refreshButtonLoading').hide();
			$('#refreshButtonSearch').show();
		}
	}

	function hideLoading(trans) {
		if (!publicAddr) {
			trans = true;
		}

		if (trans) {
			$('#loadingTransactions2').removeClass('fa-spin');
			$('#loadingTransactions2').removeClass('dim');
			$('#refreshButtonLoading').hide();
			$('#refreshButtonSearch').show();
		}
	}

	function myClick() {
		if (running)
			requestID++;
		if (!initiated) {
			autoStart = true;
			return;
		}

		hideError();
		hideHint();
		//disableInput(true);

		// validate address
		if (!autoStart)
			publicAddr = getAddress();

		autoStart = false;
		if (publicAddr) {
			window.location.hash = publicAddr;
			getAll(false, requestID);

		}
		else {
			//placeholder();
			console.log('invalid input');
			disableInput(false);
			hideLoading(true);
		}
	}

	function getAll(autoload, rqid) {
		//if(running)
		//	return;

		running = true;

		trigger_2 = true;

		lastResult2 = undefined;

		if (publicAddr) {
			setStorage();
			window.location.hash = publicAddr;
			if (table2Loaded) {
				recentTable.clear().draw();
			}
			getTrans(rqid);

		} else {
			running = false;
		}
	}


	function getTrans(rqid) {
		if (!trigger_2)
			return;

		if (showTransactions) {

			trigger_2 = false;
			//disableInput(true);

			showLoading(true);

			if (blocknum > 0) // blocknum also retrieved on page load, reuse it
			{
				console.log('blocknum re-used');
				startblock = getStartBlock();
				getTransactions(rqid);
			}
			else {
				console.log("try blocknum v2");
				_util.blockNumber(_delta.web3, (err, num) => {
					if (num) {
						blocknum = num;
						startblock = getStartBlock();
					}
					getTransactions(rqid);
				});
			}
		}
	}

	function validateDays(input = undefined) {
		if (!input) {
			input = $('#days').val();
		} else {
			input = parseFloat(input);
		}

		var days = 1;
		if (input < 0.25)
			days = 0.25;
		else if (input > 999)
			days = 999;
		else
			days = input;

		transactionDays = days;
		getStartBlock();
		$('#days').val(days);
	}

	function setDaySelector() {
		useDaySelector = true;
		endblock = 'latest';
		validateDays();
		$('#days').prop('disabled', false);
		$('#monthSelect').prop('disabled', true);
	}

	function setMonthSelector() {
		useDaySelector = false;
		checkMonthInput();
		$('#monthSelect').prop('disabled', false);
		$('#days').prop('disabled', true);
	}

	function checkMonthInput() {
		let val = Number($('#monthSelect').val());

		if (val < 0) val = 0;
		if (val > _delta.config.blockMonths.length - 1) val = _delta.blockMonths.length - 1;

		startblock = _delta.config.blockMonths[val].blockFrom;
		endblock = _delta.config.blockMonths[val].blockTo;

		getStartBlock();
	}

	function getStartBlock() {
		if (useDaySelector) {
			if (blocknum != -1) {
				startblock = Math.floor(blocknum - ((transactionDays * 24 * 60 * 60) / blocktime));
			}
			endblock = 'latest';
		}
		return startblock;
	}

	function getTransactions(rqid) {
		let outputHashes = {};

		transLoaded = 0;
		let transResult = [];
		let inTransResult = [];
		let tokenTxResult = [];
		let idexTx = [];

		let normalRetries = 0;
		let internalRetries = 0;
		let tokenRetries = 0;
		let idexRetries = 0;

		normalTransactions();
		internalTransactions();
		tokenTransactions();
		idexTrades();



		//get a list of recent outgoing tx from etherscan
		function normalTransactions() {
			$.getJSON('https://api.etherscan.io/api?module=account&action=txlist&address=' + publicAddr + '&startblock=' + startblock + '&endblock=' + endblock + '&sort=desc&apikey=' + _delta.config.etherscanAPIKey).done((result) => {
				if (requestID > rqid)
					return;
				if (result && result.status === '1')
					transResult = result.result;
				transLoaded++;
				processTransactions();
			}).fail((result) => {
				if (requestID > rqid)
					return;
				if (normalRetries < 2) {
					normalRetries++;
					normalTransactions();
					return;
				} else {
					showError('Failed to load recent transactions (deposit, trade & cancel) after 3 tries, try again later.');
					transLoaded++;
					processTransactions();
				}
			});
		}


		function tokenTransactions() {
			$.getJSON('https://api.etherscan.io/api?module=account&action=tokentx&address=' + publicAddr + '&startblock=' + startblock + '&endblock=' + endblock + '&sort=desc&apikey=' + _delta.config.etherscanAPIKey).done((result) => {
				if (requestID > rqid)
					return;
				if (result && result.status === '1')
					tokenTxResult = result.result;
				transLoaded++;
				processTransactions();
			}).fail((result) => {
				if (requestID > rqid)
					return;
				if (tokenRetries < 2) {
					tokenRetries++;
					tokenTransactions();
					return;
				} else {
					showError('Failed to load recent transactions (token transfers) after 3 tries, try again later.');
					transLoaded++;
					processTransactions();
				}
			});
		}


		function internalTransactions() {
			// internal ether transactions (withdraw)
			$.getJSON('https://api.etherscan.io/api?module=account&action=txlistinternal&address=' + publicAddr + '&startblock=' + startblock + '&endblock=' + endblock + '&sort=desc&apikey=' + _delta.config.etherscanAPIKey).done((result2) => {
				if (requestID > rqid)
					return;
				if (result2 && result2.status === '1')
					inTransResult = result2.result;
				transLoaded++;
				processTransactions();
			}).fail((result) => {
				if (requestID > rqid)
					return;
				if (internalRetries < 2) {
					internalRetries++;
					internalTransactions();
					return;
				} else {
					showError('Failed to load recent transactions (withdraws) after 3 tries, try again later.');
					transLoaded++;
					processTransactions();
				}
			});
		}

		function idexTrades() {
			let end = Math.round(new Date().getTime() / 1000);
			let start = end - (transactionDays * (24 * 60 * 60));

			$.getJSON('https://api.idex.market/returnTradeHistory?address=' + publicAddr + '&start=' + start + '&end=' + end).done((result) => {
				if (requestID > rqid)
					return;
				if (result) {
					let keys = Object.keys(result);
					for (let k = 0; k < keys.length; k++) {
						let trades = result[keys[k]];
						for (let t = 0; t < trades.length; t++) {
							let trade = undefined;
							try {
								trade = _delta.parseRecentIdexTrade(keys[k], trades[t], publicAddr);
							} catch (e) {
								console.log('failed to parse idex trade');
							}
							if (trade) {
								idexTx.push(trade);
							}
						}
					}
				}
				transLoaded++;
				processTransactions();
			}).fail((result) => {
				if (requestID > rqid)
					return;
				if (idexRetries < 2) {
					idexRetries++;
					idexTrades();
					return;
				} else {
					showError('Failed to load IDEX trades from the IDEX API');
					transLoaded++;
					processTransactions();
				}
			});
		}


		function processTransactions() {
			outputHashes = {};
			let newTokens = [];

			let myAddr = publicAddr.toLowerCase();
			let setNewDates = false;

			//idex trades from the API are independent, just add those
			if (idexTx && idexTx.length > 0) {
				for (let i = 0; i < idexTx.length; i++) {
					outputHashes[idexTx[i].Hash + '(0)'] = idexTx[i];
				}
			}

			//first parse regular outgoing transactions
			if (transResult && transResult.length > 0) {
				let txs = prepareTransactions(transResult);
				parseTransactions(txs);
			}
			// secondly do internal transfers (receive ETH from contract)
			if (inTransResult && inTransResult.length > 0) {
				let txs = prepareTransactions(inTransResult);
				parseTransactions(txs);
			}
			// at last, hande tx from etherscan token transfer events (bad from & to addresses in input)
			if (tokenTxResult && tokenTxResult.length > 0) {
				let txs = prepareTransactions(tokenTxResult);
				parseTransactions(txs);
			}

			// did we encounter previously unknown dates for blocknumbers
			if (setNewDates)
				setBlockStorage();

			//save any unknown tokens we encountered
			try {
				if (unknownTokenCache && unknownTokenCache.length >= 0) {
					unknownTokenCache = unknownTokenCache.concat(newTokens);
					setStorage();
				}
			} catch (e) { console.log('failed to set token cache'); }

			done();

			// filter out duplicate transactions and non relevant tx
			function prepareTransactions(array) {
				let preparedTxs = [];
				for (let i = 0; i < array.length; i++) {
					let tx = array[i];
					let defaultHash = tx.hash + '(0)'
					// only parse tx if..
					if (
						!outputHashes[defaultHash] ||  // we don't know it yet
						outputHashes[defaultHash].Incomplete ||
						outputHashes[defaultHash].exchange == "" || // we parsed it with no detected exchange, different source might help
						(tx.contractAddress && //token transfer event
							(outputHashes[defaultHash].Token.unknown ||  //parsed it but didn't know token, we get new token data from etherscan transfer events
								outputHashes[defaultHash].Token.addr === _delta.config.ethAddr // we parsed ETH, now we see a token transfer
							)
						) ||
						(tx.type == "call") //internal eth transfer 
					) {

						let from = tx.from.toLowerCase();
						let to = tx.to.toLowerCase();
						let contract = tx.contractAddress;
						if (contract)
							contract = contract.toLowerCase();

						//save etherscan block dates in cache for tx details & history
						if (tx.blockNumber) {

							let block = tx.blockNumber;
							if (!blockDates[block]) {
								blockDates[block] = _util.toDateTime(tx.timeStamp);
								setNewDates = true;
							}

							if (Number(block) >= startblock) { // etherscan token events seem to return before startblock

								// if we know a name for this address (token, exchange, exchangeadmin), it is useful
								if (_delta.addressName(from) !== from || _delta.addressName(to) !== to || to == myAddr || from == myAddr || (contract && _delta.addressName(contract) !== contract)) {
									preparedTxs.push(tx);
								}
							}
						} else {
							console.log('preparing tx without block number');
						}
					}
				}
				return preparedTxs;
			}

			//parse outgoing tx and token transfer tx from etherscan
			function parseTransactions(inputTransactions) {
				for (let i = 0; i < inputTransactions.length; i++) {
					var tx = inputTransactions[i];
					var from = tx.from.toLowerCase();
					var to = tx.to.toLowerCase();
					var value = _util.weiToEth(tx.value); // eth value of tx

					let contract = tx.contractAddress; //only on token transfer events form etherscan API
					let internal = tx.type == "call" || tx.gasUsed == "0"; //from internal tx request

					if (contract) {
						tx.isError = '0';  // token events have no error param
						contract = contract.toLowerCase();

						//try to see if it is an unknown token
						try {
							if (!_delta.uniqueTokens[contract]) {

								if (tx.tokenSymbol !== "" && tx.tokenDecimal !== "") {
									let newToken = {
										addr: contract,
										name: _util.escapeHtml(tx.tokenSymbol),
										name2: _util.escapeHtml(tx.tokenName),
										decimals: Number(tx.tokenDecimal),
										unlisted: true,
									};
									_delta.uniqueTokens[contract] = newToken;
									newTokens.push(newToken);
								}
							}
						} catch (e) { }
					}

					// this is a token transfer seen after we already have a 'buy up to, sell up to'
					//oasisdex, kyber
					if (checkTradeupTo(0) || checkTradeupTo(1)) { //index 1 for oasisDirect subcall
						continue;
					}

					function checkTradeupTo(index) {
						if (contract || internal) {
							// this is a token/ETH transfer seen after we already have a 'buy up to, sell up to'
							//oasisdex, kyber, uniswap
							let defaultHash = tx.hash + '(' + index + ')';
							if (outputHashes[defaultHash]) {
								let knownObj = outputHashes[defaultHash];

								if (contract && knownObj.refundEth && !knownObj.anotherIteration) {// don't evalute tokens if we need to check ETH
									return false;
								}
								if (knownObj.Type.indexOf('up to') !== -1) {
									let token = undefined;
									if (contract) {
										token = _delta.uniqueTokens[contract];
									} else if (internal) {
										token = _delta.setToken(_delta.config.ethAddr);
									}

									if (token) {
										if (internal && _util.isWrappedETH(knownObj.Token.addr)) { // match ETH and WETH
											knownObj.Token = token;
										} else if (internal && _util.isWrappedETH(knownObj.Base.addr)) { // match ETH and WETH
											knownObj.Base = token;
										}

										const dvsr = _delta.divisorFromDecimals(token.decimals)
										let newAmount = _util.weiToEth(tx.value, dvsr);
										let anotherIteration = false; //after fixing with internal tx, also use token tx

										if (token.addr == knownObj.Base.addr) {
											// amount + max/min price, unknown total
											if (knownObj.Amount) {
												if (knownObj.refundEth && token.addr == _delta.config.ethAddr) {
													if (knownObj.Total) {
														knownObj.Total = knownObj.Total.minus(newAmount);
													} else {
														return false;
													}
												} else {
													knownObj.Total = newAmount;
												}
												knownObj.Price = knownObj.Total.div(knownObj.Amount);
											}

										} else if (token.addr == knownObj.Token.addr) {
											// total and max/min price, unknown amount
											if (knownObj.Total) {
												knownObj.Amount = newAmount;
												knownObj.Price = knownObj.Total.div(knownObj.Amount);
											}

										} else {
											return false;
										}
										if (!anotherIteration) {
											if (knownObj.Type == 'Sell up to') {
												knownObj.Type = 'Taker Sell';
											} else if (knownObj.Type == 'Buy up to') {
												knownObj.Type = 'Taker Buy';
											}
											knownObj.Incomplete = false;
										} else {
											knownObj.anotherIteration = true;
										}
										outputHashes[defaultHash] = knownObj;
										return true;
									}
								}
							}
						}
						return false;
					}


					let fromName = _delta.addressName(from).toLowerCase();
					// internal tx (withdraw or unwrap ETH)
					if (to === myAddr && !contract && internal && fromName.indexOf('kyber') == -1) {
						var trans = undefined;

						if (_util.isWrappedETH(from)) {
							trans = createOutputTransaction('Unwrap', _delta.setToken(tx.from), value, getEther(), value, tx.hash, tx.timeStamp, true, '', tx.isError === '0', '');
							trans.Incomplete = true;
						}
						//Usually ignore internal ETH from an exchange, because we already get a withdraw transaction
						// check for special cases like admin withdrawals & refunds.
						else if (_delta.isExchangeAddress(from)) {
							// IDEX, Switcheo withdraw, only found in internal tx
							if (_delta.config.exchangeContracts.Idex.addr == from || _delta.config.exchangeContracts.Switcheo.addr == from) {
								trans = createOutputTransaction('Withdraw', getEther(), value, '', '', tx.hash, tx.timeStamp, false, '', tx.isError === '0', _delta.addressName(tx.from, false));
							}
							// used to detect airswap fails that send back the same ETH amount
							else {
								trans = createOutputTransaction('In', getEther(), value, '', '', tx.hash, tx.timeStamp, true, '', tx.isError === '0', fromName);
								if (_delta.config.exchangeContracts.AirSwap.addr == from && value.greaterThan(0)) {
									trans.Incomplete = true; //should be a tx with actual input, this is a refund
								} else if (_delta.config.uniswapContracts[from]) {
									trans.Incomplete = true;
								} else {
									// most likely a redundant internal tx, mark it expendable to overwrite it with any other source
									trans.Expendable = true;
								}
							}
						} else if (value.greaterThan(0)) {
							let amount = value;

							let exchange = '';
							//Ether transfer
							if (tx.input !== '0x') {
								exchange = 'unknown ';
							}
							// do we know an alias, but not a token
							if (_delta.addressName(to) !== to && !_delta.uniqueTokens[to]) {
								exchange = _delta.addressName(to);
							} else if (_delta.addressName(from) !== from && !_delta.uniqueTokens[from]) {
								exchange = _delta.addressName(from);
							}

							if (to === myAddr) {
								trans = createOutputTransaction('In', getEther(), amount, '', '', tx.hash, tx.timeStamp, true, '', tx.isError === '0', exchange);
								trans.Incomplete = true;
							} else if (from === myAddr) {
								trans = createOutputTransaction('Out', getEther(), amount, '', '', tx.hash, tx.timeStamp, true, '', tx.isError === '0', exchange);
								trans.Incomplete = true;
							}
						}
						if (trans) {
							addTransaction(trans, 0);
						}
					}

					//new etherscan token transfers without tx.input parameter
					// detect admin withdraws without input
					else if (contract && (!tx.input || tx.input == "deprecated") && to === myAddr) {
						if (_delta.isExchangeAddress(from)) {

							let token = _delta.setToken(contract);
							let dvsr = _util.divisorFromDecimals(token.decimals);
							let amount = _util.weiToEth(tx.value, dvsr);

							if (_delta.config.exchangeContracts.Idex.addr == from || _delta.config.exchangeContracts.Switcheo.addr == from) {
								trans = createOutputTransaction('Withdraw', token, amount, '', '', tx.hash, tx.timeStamp, false, '', tx.isError === '0', _delta.addressName(tx.from, false));
							} else {
								//exchange without admin withdraw?
								trans = createOutputTransaction('In', token, amount, '', '', tx.hash, tx.timeStamp, false, '', tx.isError === '0', _delta.addressName(tx.from, false));
							}
						} else {
							addUnknownTransfer();
						}
					}
					// A standard, non-internal transaction.  token deposit/withdraw, trades, cancels, etc.
					else {
						var unpacked = _util.processInput(tx.input);
						if (unpacked && unpacked.name) {
							let objs = _delta.processUnpackedInput(tx, unpacked);

							if (objs) {
								if (!Array.isArray(objs)) {
									objs = [objs];
								}

								for (let i = 0; i < objs.length; i++) {
									let obj = objs[i];

									let trans = undefined;
									let exchange = obj.exchange;
									let exName = ''
									if (!exchange) {
										exName = _delta.addressName(to, false);
										if (contract && exName.slice(0, 2) == '0x')
											exName = _delta.addressName(from, false);
										if (exName.slice(0, 2) !== '0x')
											exchange = exName;
									}

									if (unpacked.name === 'deposit' || unpacked.name === 'depositEther') {
										if (obj.type.indexOf('Wrap') >= 0) {
											trans = createOutputTransaction('Wrap', obj['token In'], obj.amount, obj['token Out'], obj.amount, tx.hash, tx.timeStamp, true, '', tx.isError === '0', '');
											if (!obj['token In'] && !contract) { //ethfinex wrapping, token in can be undefined (not in input data)
												trans.Incomplete = true;
											}
										} else {
											trans = createOutputTransaction(obj.type, obj.token, obj.amount, '', '', tx.hash, tx.timeStamp, false, '', tx.isError === '0', exchange);
										}
									}
									else if (unpacked.name === 'withdraw' && obj.type !== 'Token Withdraw') {

										if (obj.type.indexOf('Unwrap') >= 0) {
											trans = createOutputTransaction('Unwrap', obj['token In'], obj.amount, obj['token Out'], obj.amount, tx.hash, tx.timeStamp, true, '', tx.isError === '0', '');

											if (!obj['token Out'] && !contract) { //ethfinex wrapping, token in can be undefined (not in input data)
												trans.Incomplete = true;
											}
										} else {
											trans = createOutputTransaction(obj.type, obj.token, obj.amount, '', '', tx.hash, tx.timeStamp, false, '', tx.isError === '0', exchange);
										}
									}
									else if (unpacked.name === 'depositToken' || unpacked.name === 'withdrawToken' || unpacked.name === 'depositBoth') {
										obj.type = obj.type.replace('Token ', '');
										if (unpacked.name !== 'depositBoth') {
											trans = createOutputTransaction(obj.type, obj.token, obj.amount, '', '', tx.hash, tx.timeStamp, obj.unlisted, '', tx.isError === '0', exchange);
										} else {
											trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, '', tx.isError === '0', exchange);
										}
									} else if (unpacked.name === 'adminWithdraw' || (unpacked.name == 'withdraw' && unpacked.params.length == 9)/*switcheo withdraw*/) {

										//this is only in etherscan tx events
										exchange = _delta.addressName(from, false);
										if (exchange.slice(0, 2) == '0x') {
											exchange = 'unknown ';
										}
										obj.type = obj.type.replace('Token ', '');
										trans = createOutputTransaction(obj.type, obj.token, obj.amount, '', '', tx.hash, tx.timeStamp, obj.unlisted, '', tx.isError === '0', exchange);
									}
									else if (unpacked.name === 'depositAndApprove') {
										if (i == 0) { //wrap eth to veil ETH
											trans = createOutputTransaction('Wrap', obj['token In'], obj.amount, obj['token Out'], obj.amount, tx.hash, tx.timeStamp, true, '', tx.isError === '0', '');
										} else { // approve veil ETH
											trans = createOutputTransaction(obj.type, obj.token, obj.amount, '', '', tx.hash, tx.timeStamp, obj.unlisted, '', tx.isError === '0', exchange);
										}
									}
									else if ((unpacked.name == 'kill' || unpacked.name == 'cancel') && unpacked.params.length == 1) {
										trans = createOutputTransaction(obj.type, undefined, undefined, undefined, undefined, tx.hash, tx.timeStamp, undefined, undefined, tx.isError === '0', exchange);
									} else if (unpacked.name == 'buy' && unpacked.params.length == 2) {
										trans = createOutputTransaction(obj.type, undefined, undefined, undefined, undefined, tx.hash, tx.timeStamp, undefined, undefined, tx.isError === '0', exchange);
									}
									else if (unpacked.name === 'cancelOrder' || unpacked.name === 'batchCancelOrders' || unpacked.name === 'cancel' || unpacked.name == 'cancelAllSellOrders' || unpacked.name == 'cancelAllBuyOrders') {
										let cancelAmount = '';
										if (obj.baseAmount)
											cancelAmount = obj.baseAmount;
										if (obj.relayer) {
											let relay = _util.relayName(obj.relayer);
											if (relay) {
												exchange = relay;
											}
										}
										trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, cancelAmount, tx.hash, tx.timeStamp, obj.unlisted, obj.price, tx.isError === '0', exchange);
									} else if (unpacked.name === 'cancelOrdersUpTo') {
										trans = createOutputTransaction('Cancel All', '', '', '', '', tx.hash, tx.timeStamp, true, '', tx.isError === '0', obj.exchange);
									}
									else if (unpacked.name === 'trade' || unpacked.name === 'order' || unpacked.name === 'fill' || unpacked.name === 'tradeEtherDelta' || unpacked.name === 'instantTrade' || unpacked.name === 'tradeWithHint') {

										if (unpacked.name === 'tradeWithHint' || (unpacked.name === 'trade' && unpacked.params.length === 7)) {
											//kyber only
											if (obj.type == 'Buy up to') {
												trans = createOutputTransaction(obj.type, obj.token, undefined, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, obj.maxPrice, tx.isError === '0', exchange);
											} else {
												trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, undefined, tx.hash, tx.timeStamp, obj.unlisted, obj.minPrice, tx.isError === '0', exchange);
											}
											trans.Incomplete = true; // interntal tx or token transfer might add info
										} else {
											// other trade
											trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, obj.price, tx.isError === '0', exchange);
										}
									} else if (unpacked.name == 'takeSellOrder' || unpacked.name == 'takeBuyOrder' || unpacked.name == 'makeSellOrder' || unpacked.name == 'makeBuyOrder') {

										if (obj.maker == myAddr) {// maker trade from etherscan token event
											if (obj.type == 'Taker Buy') {
												obj.type = 'Maker Sell';
											} else if (obj.type == 'Taker Sell') {
												obj.type = 'Maker Buy';
											}
										}
										trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, obj.price, tx.isError === '0', exchange);
									}
									// easytrade
									else if (unpacked.name === 'buy' || unpacked.name == 'sell' || unpacked.name == 'createSellOrder' || unpacked.name == 'createBuyOrder') {
										trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, '', tx.isError === '0', exchange);
										if (unpacked.name === 'buy' || unpacked.name == 'createBuyOrder') {
											trans.Incomplete = true;
											trans.refundEth = true;
										}
									}
									//bancor
									else if (unpacked.name === 'convert' || unpacked.name === 'quickConvert' || unpacked.name === 'quickConvertPrioritized'
										|| unpacked.name === 'convertFor' || unpacked.name == 'convertForPrioritized' || unpacked.name === 'convertForPrioritized2') {

										if (obj.type == 'Buy up to') {
											// did send ETH along with tx and base is wrapped ether
											if (obj.base && _util.isWrappedETH(obj.base.addr) && value.greaterThan(0)) {
												if (String(value) == String(obj.baseAmount)) {
													obj.base = _delta.setToken(_delta.config.ethAddr);
												}
											}
											trans = createOutputTransaction(obj.type, obj.token, undefined, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, obj.maxPrice, tx.isError === '0', exchange);
											trans.Incomplete = true;
										} else {
											trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, undefined, tx.hash, tx.timeStamp, obj.unlisted, obj.minPrice, tx.isError === '0', exchange);
											//internal tx to unwrap eth token
											trans.Incomplete = true;
										}
									} //OasisDex proxies like OasisDirect
									else if ((unpacked.name == 'execute' && obj && obj.type !== "Indirect execution") // indirect delegatecall of functions below
										|| (
											(unpacked.name == 'buyAllAmount'
												|| (unpacked.name == 'buyAllAmountPayEth' && !contract)
												|| unpacked.name == 'buyAllAmountBuyEth'
												|| unpacked.name == 'createAndBuyAllAmount'
												|| (unpacked.name == 'createAndBuyAllAmountPayEth' && !contract)
												|| unpacked.name == 'createAndBuyAllAmountBuyEth'
												|| unpacked.name == 'sellAllAmount'
												|| (unpacked.name == 'sellAllAmountPayEth' && !contract)
												|| unpacked.name == 'sellAllAmountBuyEth'
												|| unpacked.name == 'createAndSellAllAmount'
												|| (unpacked.name == 'createAndSellAllAmountPayEth' && !contract)
												|| unpacked.name == 'createAndSellAllAmountBuyEth'
											)
											&& (unpacked.params[0].name == 'otc' || unpacked.params[0].name == 'factory')
										)
									) {
										if (!contract) {
											if (obj.type == 'Buy up to') {
												if (obj.baseAmount) {
													trans = createOutputTransaction(obj.type, obj.token, undefined, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, obj.maxPrice, tx.isError === '0', exchange);
												} else if (obj.amount) {
													trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, undefined, tx.hash, tx.timeStamp, obj.unlisted, obj.maxPrice, tx.isError === '0', exchange);
												}
											} else if (obj.type == 'Sell up to') {
												if (obj.amount) {
													trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, undefined, tx.hash, tx.timeStamp, obj.unlisted, obj.minPrice, tx.isError === '0', exchange);
												} else {
													trans = createOutputTransaction(obj.type, obj.token, undefined, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, obj.minPrice, tx.isError === '0', exchange);
												}
											}
											trans.Incomplete = true; // interntal tx or token transfer might add info
										}
										// someone else using oasisDirect, fills my order?
										else if (contract && to == myAddr) {
											if (obj.type === 'Buy up to') {
												if (contract == obj.token.addr) {
													obj.type = 'Maker Sell';
												} else {
													continue;
												}
											}
											else if (obj.type === 'Sell up to') {
												if (contract == obj.token.addr) {
													obj.type = 'Maker Buy';

												} else {
													continue;
												}
											}

											exchange = 'OasisDex ';
											let token = obj.token;
											let dvsr = _delta.divisorFromDecimals(token.decimals);
											let amount = _util.weiToEth(tx.value, dvsr);
											trans = createOutputTransaction(obj.type, obj.token, amount, obj.base, undefined, tx.hash, tx.timeStamp, obj.unlisted, undefined, tx.isError === '0', exchange);
										}
									}
									//erc20 erc721 approvals
									else if (unpacked.name === 'approve' || unpacked.name === 'setApprovalForAll') {
										if (!exchange) {
											if (_delta.isExchangeAddress(obj.to)) {
												exchange = _delta.addressName(obj.to.toLowerCase(), false);
											} else {
												exchange = '';
											}
										}
										if (unpacked.name === 'approve' && obj.amount.greaterThan(999999999999999))
											obj.amount = '';
										trans = createOutputTransaction(obj.type, obj.token, obj.amount, '', '', tx.hash, tx.timeStamp, obj.unlisted, '', tx.isError === '0', exchange);
									}
									//ddex hydro trade input (v1.0 & v1.1)
									else if (unpacked.name == 'matchOrders' && (unpacked.params.length > 0 && unpacked.params[0].name === 'takerOrderParam')) {
										if (obj.maker == myAddr /*|| obj.taker == myAddr*/) {
											// maker trade, verify amount filled with tokens received/sent based on buy/sell
											if (contract && i > 0 && ((obj.type == 'Maker Buy' && to == myAddr) || (obj.type == 'Maker Sell' && from == myAddr))) { // etherscan token transfer api  
												if (contract == obj.token.addr) {
													let dvsr = _delta.divisorFromDecimals(obj.token.decimals)
													let amount = _util.weiToEth(tx.value, dvsr);

													if (obj.amount.greaterThan(amount)) {
														obj.amount = amount;
														obj.baseAmount = obj.amount.times(obj.price);
													}
												} else if (contract == obj.base.addr) {
													let dvsr = _delta.divisorFromDecimals(obj.base.decimals)
													let amount = _util.weiToEth(tx.value, dvsr);

													if (obj.baseAmount.greaterThan(amount)) {
														obj.baseAmount = amount;
														obj.amount = obj.baseAmount.div(obj.price);
													}
												}

												trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, obj.price, tx.isError === '0', exchange);
											}
											//taker trade, verify amount with tokens sent/received based on buy/sell
											else if (contract && i == 0 && ((obj.type == 'Buy up to' && to == myAddr) || (obj.type == 'Sell up to' && from == myAddr))) {
												if (contract == obj.token.addr) {
													let dvsr = _delta.divisorFromDecimals(obj.token.decimals)
													let amount = _util.weiToEth(tx.value, dvsr);

													if (amount.equals(obj.amount)) {
														obj.type = 'Taker ' + obj.type.replace(' up to', '');
													} else if (obj.amount.greaterThan(amount)) {
														obj.amount = amount;
														obj.baseAmount = undefined;
													}

												} else if (contract == obj.base.addr) {
													let dvsr = _delta.divisorFromDecimals(obj.base.decimals)
													let amount = _util.weiToEth(tx.value, dvsr);

													if (amount.equals(obj.baseAmount)) {
														obj.type = 'Taker ' + obj.type.replace(' up to', '');
													} else if (obj.baseAmount.greaterThan(amount)) {
														obj.baseAmount = amount;
														obj.amount = undefined;
													}
												}

												/* taker trade can fill multiple maker trades with multiple token transactions, check if we processed one before, and if so, add them up */
												let skipTrans = false;
												let mainHash = tx.hash + '(' + i + ')';
												if (outputHashes[mainHash] && outputHashes[mainHash].Type == obj.type && obj.type.indexOf('up to') !== -1) {
													if (!obj.amount) {
														outputHashes[mainHash].Total = outputHashes[mainHash].Total.plus(obj.baseAmount);
														skipTrans = true;
													} else if (!obj.baseAmount) {
														outputHashes[mainHash].Amount = outputHashes[mainHash].Amount.plus(obj.amount);
														skipTrans = true;
													}
												}
												if (!skipTrans) {
													trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, obj.price, tx.isError === '0', exchange);
													trans.Incomplete = true;
												}
											}
										}
									}
									else if (unpacked.name === 'fillOrder' // 0xv1 0xv2
										|| unpacked.name === 'fillOrKillOrder' //0xv1 0xv2
										|| unpacked.name === 'batchFillOrders' //0xv1 0xv2
										|| unpacked.name === 'batchFillOrKillOrders' //0xv1 0xv2
										|| unpacked.name === 'fillOrdersUpTo' //0xv1
										|| unpacked.name === 'fillOrderNoThrow' //0xv2
										|| unpacked.name === 'batchFillOrdersNoThrow' //0xv2
										|| unpacked.name === 'marketSellOrders' //0xv2
										|| unpacked.name === 'marketSellOrdersNoThrow' //0xv2
										|| unpacked.name === 'marketBuyOrders' //0xv2
										|| unpacked.name === 'marketBuyOrdersNoThrow' //0xv2
										|| unpacked.name === 'matchOrders' //0xv2
										|| unpacked.name == 'marketBuyOrdersWithEth' //0x instant v2
										|| unpacked.name == 'marketSellOrdersWithEth' //0x instant v2
										|| (unpacked.name == 'executeTransaction' && obj.type !== "Signed execution") //0xv2
									) {
										if ((obj.maker == myAddr || obj.taker == myAddr)
											&& (!contract  //tx sent by me
												|| (contract && (to == myAddr || from == myAddr) && obj.type.indexOf('up to') == -1) //tx received as maker ('up to' excludes fillUpTo and marketBuy/marketSell)
											)) {

											if (obj.maker === myAddr) {
												if (obj.type == 'Taker Buy') {
													obj.type = 'Maker Sell';
												} else if (obj.type == 'Taker Sell') {
													obj.type = 'Maker Buy';
												}
											}
											let price = obj.price;
											let incomplete = false;

											if (unpacked.name === 'fillOrdersUpTo' || unpacked.name.indexOf('market') !== -1) {
												if (i == 0) {
													price = obj.maxPrice;
												} else {
													if (!contract && obj.taker == myAddr) {
														continue;
													}
													// maker side of market buy/sell, check if entire order was filled by amount of tokens transferred
													if (contract) { // etherscan token transfer api
														if (contract == obj.token.addr) {
															let dvsr = _delta.divisorFromDecimals(obj.token.decimals)
															let amount = _util.weiToEth(tx.value, dvsr);

															if (obj.amount.greaterThan(amount)) {
																obj.amount = amount;
																obj.baseAmount = obj.amount.times(obj.price);
															}

														} else if (contract == obj.base.addr) {
															let dvsr = _delta.divisorFromDecimals(obj.base.decimals)
															let amount = _util.weiToEth(tx.value, dvsr);

															if (obj.baseAmount.greaterThan(amount)) {
																obj.baseAmount = amount;
																obj.amount = obj.baseAmount.div(obj.price);
															}
														}
													}
												}
												incomplete = true;
											}
											if (obj.relayer && unpacked.name.indexOf('WithEth') == -1) { //exclude 0x instant from
												let relay = _util.relayName(obj.relayer);
												if (relay) {
													exchange = relay;
												}
											}
											trans = createOutputTransaction(obj.type, obj.token, obj.amount, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, price, tx.isError === '0', exchange);
											trans.Incomplete = incomplete;
											if (unpacked.name.indexOf('WithEth') !== -1) {
												trans.refundEth = true;
											}
										}
									} else if (unpacked.name === 'offer') {
										let type = obj.type;
										if (contract && to == myAddr) {
											if (type === 'Buy offer') {
												if (contract == obj.token.addr) {
													type = 'Maker Buy';
												} else {
													type = 'Maker Sell';
												}
											}
											else if (type === 'Sell offer') {
												if (contract == obj.token.addr) {
													type = 'Maker Sell';
												} else {
													type = 'Maker Buy';
												}
											}
											if (exchange == "") {
												exchange = 'OasisDex ';
											}
										}
										trans = createOutputTransaction(type, obj.token, obj.amount, obj.base, obj.baseAmount, tx.hash, tx.timeStamp, obj.unlisted, obj.price, tx.isError === '0', exchange);
										trans.Incomplete = true;
									} else if (unpacked.name === 'transfer') {
										let newType = '';
										if (obj.from == myAddr) {
											newType = 'Out';
										} else if (obj.to.toLowerCase() == myAddr) {
											newType = 'In';
										}
										let exch = '';
										if (_delta.config.exchangeWallets[from]) {
											exch = _delta.config.exchangeWallets[from];
										} else if (_delta.config.exchangeWallets[to]) {
											exch = _delta.config.exchangeWallets[to];
										}

										trans = createOutputTransaction(newType, obj.token, obj.amount, '', '', tx.hash, tx.timeStamp, obj.unlisted, '', tx.isError === '0', exch);
									}
									// uniswap taker trade
									else if (
										(
											(unpacked.name.indexOf('ethToToken') !== -1) ||
											(unpacked.name.indexOf('tokenToEth') !== -1) ||
											(unpacked.name.indexOf('tokenToToken') !== -1) ||
											(unpacked.name.indexOf('tokenToExchange') !== -1)
										) &&
										(
											(unpacked.name.indexOf('Transfer') !== -1) ||
											(unpacked.name.indexOf('Swap') !== -1)
										)
									) {
										//trades are made with either min-tokens or max_eth variables, omit either Total or Amount
										let amount = undefined;
										let baseAmount = undefined;
										let price = undefined;
										if (obj.amount) {
											amount = obj.amount;
											baseAmount = obj.estBaseAmount;
										} else {
											baseAmount = obj.baseAmount;
											amount = obj.estAmount;
										}
										trans = createOutputTransaction(obj.type, obj.token, amount, obj.base, baseAmount, tx.hash, tx.timeStamp, obj.unlisted, price, tx.isError === '0', obj.exchange);
										trans.Incomplete = true; // interntal tx or token transfer might add info
										if (unpacked.name.indexOf('ethToToken') !== -1 && unpacked.name.indexOf('Output') !== -1) {
											trans.refundEth = true;
										}
									}
									// uniswap Liquidity
									else if (unpacked.name == 'addLiquidity' || unpacked.name == 'removeLiquidity') {


										let token1 = obj.token;
										let amount1 = undefined;
										let token2 = undefined;
										let amount2 = undefined;
										if (unpacked.name == 'removeLiquidity') {
											amount1 = obj.minimum;
											token2 = obj['token '];
											amount2 = obj['minimum '];
										} else {
											amount1 = obj.amount;
											token2 = obj['token '];
											amount2 = obj.maximum;
										}

										trans = createOutputTransaction(obj.type, token1, amount1, token2, amount2, tx.hash, tx.timeStamp, obj.unlisted, undefined, tx.isError === '0', obj.exchange);
										if (!contract) {
											trans.Incomplete = true;
										}

									}

									if (trans) {
										addTransaction(trans, i);
									}
								}
							}
							// we can decode the transaction input into a function, but we can't parse the function into an object
							else {
								addUnknownTransfer();
							}
						}
						// not a recognized function call, but ETH or tokens still moved
						else {
							addUnknownTransfer();
						}

						// make a transaciton a transfer if we can't determine anything else
						function addUnknownTransfer() {
							let trans2 = undefined;
							let exchange = '';


							//Ether transferred or unknown func accepting ETH
							if (!contract && value.greaterThan(0)) {

								let amount = value;

								// Ether token wrapping that uses fallback
								if (_util.isWrappedETH(to)) {
									trans2 = createOutputTransaction("Wrap", getEther(), amount, _delta.uniqueTokens[to], amount, tx.hash, tx.timeStamp, true, '', tx.isError === '0', exchange);
								} else {
									//Ether transfer
									if (tx.input !== '0x') {
										exchange = 'unknown ';
									}

									// do we know an alias, but not a token
									if (_delta.addressName(to) !== to && !_delta.uniqueTokens[to]) {
										exchange = _delta.addressName(to);
									} else if (_delta.addressName(from) !== from && !_delta.uniqueTokens[from]) {
										exchange = _delta.addressName(from);
									}

									if (to === myAddr) {
										trans2 = createOutputTransaction('In', getEther(), amount, '', '', tx.hash, tx.timeStamp, true, '', tx.isError === '0', exchange);
										trans2.Incomplete = true;
									} else if (from === myAddr) {
										trans2 = createOutputTransaction('Out', getEther(), amount, '', '', tx.hash, tx.timeStamp, true, '', tx.isError === '0', exchange);
										trans2.Incomplete = true;
									}

								}
							}
							//unknown source of token transfer
							else if (contract) {
								let newType = '';
								if (from == myAddr) {
									newType = 'Out';
								} else if (to == myAddr) {
									newType = 'In';
								}

								exchange = 'unknown ';
								// do we know an alias, but not a token
								if (_delta.addressName(to) !== to && !_delta.uniqueTokens[to]) {
									exchange = _delta.addressName(to);
								} else if (_delta.addressName(from) !== from && !_delta.uniqueTokens[from]) {
									exchange = _delta.addressName(from);
								}



								let token = _delta.setToken(contract);
								//uniswap liquidity token minting/destruction
								if (token && exchange == 'unknown ' && (_delta.config.uniswapContracts[contract] || token.name.indexOf('UNI') >= 0)
									&& (from == _delta.config.ethAddr || to == _delta.config.ethAddr)) {
									exchange = 'Uniswap';
								};

								if (token) {
									let dvsr = _delta.divisorFromDecimals(token.decimals);
									let amount = _util.weiToEth(tx.value, dvsr);
									trans2 = createOutputTransaction(newType, token, amount, '', '', tx.hash, tx.timeStamp, token.unlisted, '', tx.isError === '0', exchange);
									trans2.Incomplete = true;
								}
							}

							if (trans2) {
								addTransaction(trans2, 0);
							}
						}
					}

				} // end for-loop



				function addTransaction(transs, index = 0) {
					if (transs && transs.Hash) {

						let mainHash = transs.Hash + "(" + index + ")";

						let oldTrans = outputHashes[mainHash];

						//don't replace an exisiting record with an expendable one
						if (oldTrans && transs.Expendable) {
							return;
						}
						//cases where we instantly set the txHash to the current parsed data
						if (!oldTrans //tx isn't known yet
							|| oldTrans.Expendable // old one can be replaced
							|| (transs.Type === oldTrans.Type && //tx already known of the same type AND:
								((oldTrans.Incomplete && !transs.Incomplete) // second source completed info
									|| (!oldTrans.Token && transs.Token) || (!oldTrans.Base && transs.Base) // we added a missing token
									|| (oldTrans.Token && oldTrans.Token.unknown && transs.Token && !transs.Token.unknown) // unknown token is now known
								)
							)) {
							outputHashes[mainHash] = transs;
						}
						// else try to identify which of the 2 parsed transactions for thsi same hash should be displayed

						// we parsed a different token the second time   (etherscan regular tx input vs erc20 event )
						// see if we can refine details by combining info from 2 sources
						else if (oldTrans.Token.addr !== transs.Token.addr || transs.Type !== oldTrans.Type) {

							//get exchange or wallet name
							let exchange = 'unknown ';
							if (_delta.addressName(to) !== to && !_delta.uniqueTokens[to]) {
								exchange = _delta.addressName(to);
							} else if (_delta.addressName(from) !== from && !_delta.uniqueTokens[from]) {
								exchange = _delta.addressName(from);
							}

							// oasisdex/kyber corrected from 'buy up to'to 'taker buy'
							if (oldTrans.Type.indexOf('Taker') !== -1 && transs.Type.indexOf('up to') !== -1) {
								return;
							}

							// detect where one token goes in and another goes out in same tx
							else if (transs.Type == 'In' && oldTrans.Type == 'Out') {
								let newTrans = createOutputTransaction('Trade', transs.Token, transs.Amount, oldTrans.Token, oldTrans.Amount, tx.hash, tx.timeStamp, transs.Token.unlisted, '', tx.isError === '0', exchange);
								outputHashes[mainHash] = newTrans;
							} else if (transs.Type == 'Out' && oldTrans.Type == 'In') {
								let newTrans = createOutputTransaction('Trade', oldTrans.Token, oldTrans.Amount, transs.Token, transs.Amount, tx.hash, tx.timeStamp, oldTrans.Token.unlisted, '', tx.isError === '0', exchange);
								outputHashes[mainHash] = newTrans;
							}

							//oasisDex  offer from input,  token transfer tx info makes it a full trade
							else if (oldTrans.Type.indexOf('offer') !== -1 && transs.Type.indexOf('Maker') !== -1) {
								outputHashes[mainHash] = transs;
							}
							else if (transs.Type.indexOf('offer') !== -1 && oldTrans.Type.indexOf('Maker') !== -1) {
								outputHashes[mainHash] = oldTrans;
							}

							// uniswap liquidity (1 tx input, with slippage amounts, 2 token trasnfer with actual amount, 3 internal eth with actual amount)
							else if (oldTrans.Type == 'Remove Liquidity' && transs.Type == 'In') {
								if (oldTrans.Token.addr == transs.Token.addr) {
									oldTrans.Amount = transs.Amount;
								} else if (oldTrans.Base.addr == transs.Token.addr) {
									oldTrans.Total = transs.Amount;
								}
								outputHashes[mainHash] = oldTrans;
							} else if (transs.Type == 'Remove Liquidity' && oldTrans.Type == 'In') {
								if (transs.Token.addr == oldTrans.Token.addr) {
									transs.Amount = oldTrans.Amount;
								} else if (trans.Base.addr == oldTrans.Token.addr) {
									transs.Total = oldTrans.Amount;
								}
								outputHashes[mainHash] = transs;
							} else if (oldTrans.Type == 'Add Liquidity' && transs.Type == 'Out') {
								if (oldTrans.Token.addr == transs.Token.addr) {
									oldTrans.Amount = transs.Amount;
								} else if (oldTrans.Base.addr == transs.Token.addr) {
									oldTrans.Total = transs.Amount;
								}
								outputHashes[mainHash] = oldTrans;
							} else if (transs.Type == 'Add Liquidity' && oldTrans.Type == 'Out') {
								if (transs.Token.addr == oldTrans.Token.addr) {
									transs.Amount = oldTrans.Amount;
								} else if (trans.Base.addr == oldTrans.Token.addr) {
									transs.Total = oldTrans.Amount;
								}
								outputHashes[mainHash] = transs;
							}

							// detect AirSwap sending back the same amount
							else if (oldTrans.Exchange == _delta.config.exchangeContracts.AirSwap.name && transs.Type == 'In' && oldTrans.Type == 'Taker Buy' && String(transs.Amount) == String(oldTrans.Total)) {
								outputHashes[mainHash].Status = false;
							} else if (transs.Exchange == _delta.config.exchangeContracts.AirSwap.name && transs.Type == 'Taker Buy' && oldTrans.Type == 'In' && String(transs.Total) == String(oldTrans.Amount)) {
								transs.Status = false;
								outputHashes[mainHash] = transs;
							}
							// bancor sell for ETH token & unwrap ETH token, make sell for ETH
							else if (oldTrans.Type == 'Unwrap' && transs.Type === 'Sell up to' && transs.Exchange.indexOf('Bancor') !== -1) {
								transs.Base = oldTrans.Base;
								outputHashes[mainHash] = transs;
							} else if (oldTrans.Type == 'Sell up to' && transs.Type === 'Unwrap' && oldTrans.Exchange.indexOf('Bancor') !== -1) {
								outputHashes[mainHash].Base = transs.Base;
							}
							// (trade?) returning ETH, seen as unwrap ETH by internal transaction result (generic version of bancor above)
							else if (oldTrans.Type == 'Unwrap' && transs.Type !== 'Unwrap' && transs.Exchange) {
								outputHashes[mainHash] = transs;
							} else if (oldTrans.Exchange == 'OasisDirect ' && oldTrans.Type.indexOf('up to') !== -1) {
								// don't add ETH refund
							} else if (transs.Exchange == 'OasisDirect ' && transs.Type.indexOf('up to') !== -1) {
								outputHashes[mainHash] = transs;
							}
							else { // more than 1 in, 1 out, just display tx multiple times
								let newHash = mainHash;
								while (outputHashes[newHash]) {
									newHash += ' ';
								}
								outputHashes[newHash] = transs;
							}
						}
					}
				}

			} //end parseTransactions




			function createOutputTransaction(type, token, val, base, total, hash, timeStamp, unlisted, price, status, exchange) {

				if (status === undefined)
					status = true;
				if (token || (type == 'Cancel All' || type == 'Wrap')) {

					return {
						Status: status,
						Type: type,
						Exchange: exchange,
						Token: token,
						Amount: val,
						Price: price,
						Base: base,
						Total: total,
						Hash: hash,
						Date: _util.toDateTime(timeStamp),
						Info: window.location.origin + window.location.pathname + '/../tx.html#' + hash,
					};
				} else if (exchange === 'OasisDex ') {
					return {
						Status: status,
						Type: type,
						Exchange: exchange,
						Token: '',
						Amount: '',
						Price: '',
						Base: '',
						Total: '',
						Hash: hash,
						Date: _util.toDateTime(timeStamp),
						Info: window.location.origin + window.location.pathname + '/../tx.html#' + hash,
					};
				} else {
					return undefined;
				}
			}

			function done() {
				var txs = Object.values(outputHashes);
				lastResult2 = txs;
				makeTable2(txs);
			}
		}
	}


	function showHint(text) {
		$('#hinttext').html(text);
		$('#hint').show();
	}

	function hideHint() {
		$('#hint').hide();
	}

	function showError(text) {
		$('#errortext').html(text);
		$('#error').show();
	}

	function hideError() {
		$('#error').hide();
	}

	function hidePopovers() {
		$('[data-toggle="popover"]').each(function () {
			hidePopover(this);
		});
	}

	function hidePopover(element) {
		try {
			$(element).popover('hide');
			$(element).data("bs.popover").inState = { click: false, hover: false, focus: false };
		} catch (e) { }
	}


	//transactions table
	function makeTable2(result) {

		hidePopovers();

		let filtered = result.filter((res) => { return checkFilter(res.Type); });

		var loaded = table2Loaded;
		if (changedDecimals)
			loaded = false;

		let headers = getColumnHeaders(filtered, transactionHeaders);
		if (!table2Loaded) {
			makeInitTable('#transactionsTable2', headers, transactionsPlaceholder);
		}
		let tableData = buildTableRows(filtered, headers);
		trigger2(tableData);
	}

	function placeholderTable() {
		makeTable2(transactionsPlaceholder);
	}


	// save address for next time
	function setStorage() {
		if (typeof (Storage) !== "undefined") {

			localStorage.setItem('recent-options', JSON.stringify(displayFilter));

			if (publicAddr) {
				sessionStorage.setItem('address', publicAddr);
			} else {
				sessionStorage.removeItem('address');
			}
			if (savedAddr) {
				localStorage.setItem("address", savedAddr);
			} else {
				localStorage.removeItem('address');
			}

			localStorage.setItem("decimals", decimals);

			try {
				// new tokens found in etherscan token transfer responses
				if (unknownTokenCache && unknownTokenCache.length > 0) {
					localStorage.getItem('unknownTokens1');
					let string = JSON.stringify(unknownTokenCache);
					localStorage.setItem('unknownTokens1', string);
				}
			} catch (e) {
				console.log('failed token cache');
			}
		}
	}

	function getStorage() {
		if (typeof (Storage) !== "undefined") {


			//load dropdown selection from cache
			let selection = localStorage.getItem('recent-options');
			if (selection !== null && selection.length > 0) {
				try {
					selection = JSON.parse(selection);
					let filter = [];
					Object.keys(selection).forEach(function (key) {
						if (displayFilter.hasOwnProperty(key)) {
							if (selection[key]) {
								filter.push(key);
							}
						}
					});
					toggleFilter(filter, true);
				} catch (e) { }
			}

			if (localStorage.getItem("usd") === null) {
				showDollars = true;
			} else {
				showDollars = localStorage.getItem('usd');
				if (showDollars === "false")
					showDollars = false;
			}

			if (localStorage.getItem("decimals") === null) {
				decimals = false;
			} else {
				var dec = localStorage.getItem('decimals');
				decimals = dec === "true";
			}

			// check for saved address
			if (localStorage.getItem("address") !== null) {
				var addr = localStorage.getItem("address");
				if (addr && addr.length == 42) {
					savedAddr = addr;
					addr = getAddress(addr);
					if (addr) {
						savedAddr = addr;
						setSavedImage(savedAddr);
						$('#savedAddress').html(addr.slice(0, 16));
					}
				} else {
					localStorage.removeItem("address");
				}
			}

			// check for session address between pages
			if (sessionStorage.getItem("address") !== null) {
				var addr = sessionStorage.getItem("address");
				if (addr && addr.length == 42) {
					addr = getAddress(addr);
					if (addr) {
						publicAddr = addr;
					}
				} else {
					sessionStorage.removeItem("address");
				}
			}
		}
	}


	// final callback to sort table
	function trigger2(dataSet) {

		if (!table2Loaded) {

			recentTable = $('#transactionsTable2').DataTable({
				"paging": false,
				"ordering": true,
				//"info": true,
				"scrollY": "80vh",
				"scrollX": true,
				"scrollCollapse": true,
				"order": [[9, "desc"], [8, "asc"]],
				"dom": '<"toolbar">frtip',
				"orderClasses": false,
				fixedColumns: {
					leftColumns: 2
				},
				aoColumnDefs: [
					{ bSearchable: true, aTargets: [1] },
					{ bSearchable: true, aTargets: [2] },
					{ bSearchable: true, aTargets: [3] },
					{ bSearchable: true, aTargets: [6] },
					{ bSearchable: true, aTargets: [8] },
					{ bSearchable: false, aTargets: ['_all'] },
					{ bSortable: false, aTargets: [0, 10] },
					{ asSorting: ["desc", "asc"], aTargets: [4, 5, 7, 9] },
					{ sClass: "dt-body-right", aTargets: [4, 5, 7] },
					{ sClass: "dt-body-center", aTargets: [0, 10] },
				],
				"language": {
					"search": '<i class="dim fa fa-search"></i>',
					"searchPlaceholder": "Type, Exchange, Token, Hash",
					"zeroRecords": "No transactions found",
					"info": "Showing _TOTAL_ transactions",
					"infoEmpty": "No transactions found",
					"infoFiltered": "(filtered from _MAX_ )"
				},
			});
			table2Loaded = true;
		}

		recentTable.clear();
		if (dataSet.length > 0) {
			for (let i = 0; i < dataSet.length; i++) {
				recentTable.rows.add(dataSet[i]);
			}
			recentTable.columns.adjust().fixedColumns().relayout().draw();
			$("[data-toggle=popover]").popover();
			$('[data-toggle=tooltip]').unbind();
			$('[data-toggle=tooltip]').tooltip({
				'placement': 'top',
				'container': 'body',
				'trigger': 'manual'
			}).on("mouseenter", function () {
				let _this = this;
				$('[data-toggle=tooltip]').each(function () {
					if (this !== _this) {
						$(this).tooltip('hide');
					}
				});
				$(_this).tooltip("show");
				$(".tooltip").on("mouseleave", function () {
					$(_this).tooltip('hide');
				});
			}).on("mouseleave", function () {
				let _this = this;
				setTimeout(function () {
					if (!$(".tooltip:hover").length) {
						$(_this).tooltip("hide");
					}
				}, 300);
			});
		} else {
			recentTable.columns.adjust().fixedColumns().relayout().draw();
		}

		trigger_2 = transLoaded >= 4;

		if (trigger_2) {
			disableInput(false);
			hideLoading(true);
			running = false;
			requestID++;
			buttonLoading(true);
		}
		else {
			hideLoading(trigger_2);
		}
	}

	// Builds the HTML Table out of myList.
	function buildTableRows(myList, columns) {

		let resultTable = [];

		for (var i = 0; i < myList.length; i++) {

			var row$ = $('<tr/>');

			for (var colIndex = 0; colIndex < columns.length; colIndex++) {
				var cellValue = myList[i][columns[colIndex].title];
				if (!cellValue && cellValue !== 0) cellValue = "";
				var head = columns[colIndex].title;

				if (head == 'Amount' || head == 'Price' || head == "Total") {
					if (cellValue !== "" && cellValue !== undefined && cellValue !== 'All') {
						var dec = fixedDecimals;
						if (head == 'Price')
							dec += 2;
						var num = '<span data-toggle="tooltip" title="' + _util.exportNotation(cellValue) + '">' + _util.displayNotation(cellValue, dec) + '</span>';
						row$.append($('<td/>').html(num));
					}
					else {
						if (cellValue !== "All") {
							cellValue = "";
						}
						row$.append($('<td/>').html(cellValue));
					}
				}
				else if (head == 'Token' || head == 'Base') {

					let token = cellValue;
					if (token) {
						let popover = _delta.makeTokenPopover(token);
						let search = token.name;
						if (token.name2) {
							search += ' ' + token.name2;
						}
						row$.append($('<td data-sort="' + token.name + '" data-search="' + search + '"/>').html(popover));
					} else {
						row$.append($('<td/>').html(""));
					}
				}
				else if (head == 'Type') {
					if (cellValue == 'Deposit' || cellValue == 'Approve' || (cellValue && (cellValue.indexOf('Wrap') >= 0 || cellValue.indexOf('Add') >= 0)) || cellValue == 'In') {
						row$.append($('<td/>').html('<span class="label label-success" >' + cellValue + '</span>'));
					}
					else if (cellValue == 'Withdraw' || (cellValue && (cellValue.indexOf('Unwrap') >= 0 || cellValue.indexOf('Remove') >= 0)) || cellValue == 'Out') {
						row$.append($('<td/>').html('<span class="label label-danger" >' + cellValue + '</span>'));
					}
					else if (cellValue == 'Cancel sell' || cellValue == 'Cancel buy' || cellValue == 'Cancel offer' || cellValue == 'Sell offer' || cellValue == 'Buy offer' || cellValue == 'Cancel Sell' || cellValue == 'Cancel Buy' || cellValue == 'Cancel All') {
						row$.append($('<td/>').html('<span class="label label-default" >' + cellValue + '</span>'));
					}
					else if (cellValue == 'Taker Buy' || cellValue == 'Buy up to' || cellValue == 'Maker Buy' || cellValue == 'Fill offer' || cellValue == 'Trade') {
						row$.append($('<td/>').html('<span class="label label-info" >' + cellValue + '</span>'));
					}
					else if (cellValue == 'Taker Sell' || cellValue == 'Sell up to' || cellValue == 'Maker Sell') {
						row$.append($('<td/>').html('<span class="label label-info" >' + cellValue + '</span>'));
					}
					else {
						row$.append($('<td/>').html('<span>' + cellValue + '</span>'));
					}
				}
				else if (head == 'Hash') {
					row$.append($('<td/>').html(_util.hashLink(cellValue, true, true)));
				}
				else if (head == 'Status') {
					if (cellValue)
						row$.append($('<td align="center"/>').html('<i title="success" style="color:green;" class="fa fa-check"></i>'));
					else
						row$.append($('<td align="center"/>').html('<i title="failed" style="color:red;" class="fa fa-exclamation-circle"></i>'));
				}
				else if (head == 'Info') {

					row$.append($('<td/>').html('<a href="' + cellValue + '" target="_blank"><i class="fa fa-ellipsis-h"></i></a>'));
				}
				else if (head == 'Date') {
					row$.append($('<td/>').html(_util.formatDate(cellValue, false, true)));
				}
				else {
					row$.append($('<td/>').html(cellValue));
				}
			}
			resultTable.push(row$);
		}
		return resultTable;
	}


	var transactionHeaders = { 'Token': 1, 'Amount': 1, 'Type': 1, 'Hash': 1, 'Date': 1, 'Price': 1, 'Base': 1, 'Total': 1, 'Status': 1, 'Info': 1, 'Exchange': 1 };
	// Adds a header row to the table and returns the set of columns.
	// Need to do union of keys from all records as some records may not contain
	// all records.
	function getColumnHeaders(myList, headers) {
		var columnSet = {};
		var columns = [];

		if (myList.length == 0) {
			myList = transactionsPlaceholder;
		}
		for (var i = 0; i < myList.length; i++) {
			var rowHash = myList[i];
			for (var key in rowHash) {
				if (!columnSet[key] && headers[key]) {
					columnSet[key] = 1;
					columns.push({ title: key });
				}
			}
		}
		return columns;
	}

	function makeInitTable(selector, headers, placeholderData) {

		if (!table2Loaded) {
			var header1 = $(selector + ' thead');
			var headerTr$ = $('<tr/>');

			for (let i = 0; i < headers.length; i++) {
				let head = headers[i].title;
				if (head == 'Status') {
					head = '<i title="Transaction status" class="fa fa-check"></i>';
				}
				headerTr$.append($('<th/>').html(head));
			}

			header1.append(headerTr$);
			$(selector).append(header1);


			var body = $(selector + ' tbody');
			var tbody$ = $('<tbody/>');
			var row$ = $('<tr/>');
			for (var colIndex = 0; colIndex < headers.length; colIndex++) {
				var cellValue = placeholderData[headers[colIndex].title];
				var head = headers[colIndex].title;

				if (head == 'Token') {
					row$.append($('<td data-sort="" data-search=""/>'));
				} else {
					row$.append($('<td/>'));
				}
			}
			tbody$.append(row$);
			body.append(tbody$[0].innerHTML);
		}
	}


	function getBlockStorage() {
		if (typeof (Storage) !== "undefined") {
			let dates = localStorage.getItem("blockdates");
			if (dates) {
				dates = JSON.parse(dates);
				if (dates) {
					// map date strings to objects & get count
					let dateCount = Object.keys(dates).map(x => blockDates[x] = new Date(dates[x])).length;
					console.log('retrieved ' + dateCount + ' block dates from cache');
				}

			}
		}
	}

	function setBlockStorage() {
		if (typeof (Storage) !== "undefined") {
			if (blockDates) {
				let dateCount = Object.keys(blockDates).length;
				if (dateCount > 0) {
					console.log('saved ' + dateCount + ' block dates in cache');
					localStorage.setItem("blockdates", JSON.stringify(blockDates));
				}
			}
		}
	}

	function fillMonthSelect() {
		$('#monthSelect').empty();
		var select = document.getElementById("monthSelect");

		//Create array of options to be added
		var array = _delta.config.blockMonths;

		//Create and append the options
		for (var i = array.length - 1; i >= 0; i--) {
			var option = document.createElement("option");
			option.value = i;
			option.text = array[i].m;
			select.appendChild(option);
		}
		select.selectedIndex = 0;
	}
}