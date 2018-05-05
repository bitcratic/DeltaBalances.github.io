{
	//set var historyConfig in html

	// shorthands
	var _delta = bundle.DeltaBalances;
	var _util = bundle.utility;

	// initiation
	var initiated = false;
	var autoStart = false;

	var requestID = 0;

	// loading states
	var tableLoaded = false;
	var loadedLogs = 0;
	var displayedLogs = false;

	var trigger1 = false;
	var running = false;

	var typeMode = 0;  // 0 trades, 1, deposit/withdraw, 2 all

	// settings
	var decimals = false;
	var fixedDecimals = 3;

	var showTransactions = true;
	var showBalances = true;
	var showCustomTokens = true;


	// user input & data
	var publicAddr = '';
	var savedAddr = '';
	var metamaskAddr = '';
	var lastResult = undefined;

	var blockReqs = 0;
	var blockLoaded = 0;

	// config
	var blocktime = 14;
	var blocknum = -1;
	var startblock = 0;
	var endblock = 0;
	var transactionDays = 1;
	var useDaySelector = true;
	var minBlock = historyConfig.minBlock;

	//3154197; //https://etherscan.io/block/3154196  etherdelta_2 creation
	//const minBlock tokenstore 4097028
	//minblock decentrex 3767901 

	var uniqueBlocks = {}; //date for each block
	var blockDates = {};

	// placeholder
	var transactionsPlaceholder = [
		{
			Relayer: '0x',
			Type: 'Taker',
			Trade: 'Sell',
			Token: { "name": "Token", "addr": "" },
			Amount: 0,
			Price: 0,
			Base: { "name": "Token", "addr": "" },
			Total: 0,
			Hash: '0xH4SH1',
			Date: _util.toDateTimeNow(),
			Block: '',
			Buyer: '',
			Seller: '',
			Fee: 0,
			FeeToken: { "name": "Token", "addr": "" },
			'Fee in': { "name": "Token", "addr": "" }, //shorter name feetoken
			Info: window.location.origin + window.location.pathname + '/../tx.html',
			Unlisted: true,
		},
		/*{
			Type: 'Deposit',
			Trade: '',
			Token: { "name": "Token", "addr": "0x00" },
			Amount: 0,
			Price: '',
			ETH: '',
			Hash: '0xH4SH2',
			Date: _util.toDateTimeNow(),
			Block: '',
			Buyer: '',
			Seller: '',
			Fee: '',
			FeeToken: '',
			'Fee in': '', //shorter name feetoken
			Info: window.location.origin + window.location.pathname + '/../tx.html',
			Unlisted: true,
		}*/
	];


	init();

	$(document).ready(function () {
		readyInit();
	});

	function init() {

		getBlockStorage(); // get cached block dates

		// borrow some ED code for compatibility
		_delta.startDeltaBalances(false, () => {
			//if(!autoStart)
			{
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

			_delta.initTokens(false);


			initiated = true;
			//if(autoStart)
			//	myClick();
		});
	}

	function readyInit() {

		//get metamask address as possbile input (if available)
		metamaskAddr = _util.getMetamaskAddress();
		if (metamaskAddr) {
			setMetamaskImage(metamaskAddr);
			$('#metamaskAddress').html(metamaskAddr.slice(0, 16));
		}

		$('#minBlockLink').html('<a href="https://etherscan.io/tx/' + historyConfig.createTx + '" target="_blank">' + minBlock + '</a>');

		fillMonthSelect();
		let daysDisabled = $('#days').prop('disabled');
		if (!daysDisabled)
			setDaySelector();
		else
			setMonthSelector();

		setBlockProgress(0, 0, 0, 0, 0);

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

		$('body').on('expanded.pushMenu collapsed.pushMenu', function () {
			// Add delay to trigger code only after the pushMenu animation completes
			setTimeout(function () {
				$("#transactionsTable").trigger("update", [true, () => { }]);
				$("#transactionsTable").trigger("applyWidgets");
			}, 300);
		});

		$(window).resize(function () {
			$("#transactionsTable").trigger("applyWidgets");

			//hide popovers
			$('[data-toggle="popover"]').each(function () {
				$(this).popover('hide');
				$(this).data("bs.popover").inState = { click: false, hover: false, focus: false };
			});
		});

		//dismiss popovers on click outside
		$('body').on('click', function (e) {
			$('[data-toggle="popover"]').each(function () {
				//the 'is' for buttons that trigger popups
				//the 'has' for icons within a button that triggers a popup
				if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
					$(this).popover('hide');
					$(this).data("bs.popover").inState = { click: false, hover: false, focus: false };
				}
			});
			if (!$('#refreshButtonSearch').is(e.target)) {
				hideError();
			}
		});

		getStorage();

		placeholderTable();

		// url hash #0x..
		let addr = '';
		var hash = window.location.hash;  // url parameter /#0x...
		if (hash)
			addr = hash.slice(1);

		if (addr) {
			addr = getAddress(addr);
			if (addr) {
				publicAddr = addr;
			}
		}

		if (publicAddr) {
			//autoStart = true;
			//myClick();
			window.location.hash = publicAddr;
			if (publicAddr !== savedAddr) {
				$('#forget').addClass('hidden');
			}
			$('#loadingTransactions').show();
			$("#findTransactions").show();
		} else if (savedAddr) {//autoload when remember is active
			publicAddr = savedAddr;
			$("#findTransactions").show();
			//autoStart = true;
			// auto start loading
			loadSaved();
		} else if (metamaskAddr) {
			$("#findTransactions").show();
			loadMetamask();
		}
		else if (!addr && !publicAddr) {
			$('#userToggle').addClass('hidden');
			$('#address').focus();
		}
	}

	function disableInput(disable) {
		$('#refreshButton').prop('disabled', disable);
		// $("#address").prop("disabled", disable);
		$('#loadingTransactions').addClass('dim');
		$("#loadingTransactions").prop("disabled", disable);
		$("#findTransactions").prop("disabled", disable);
	}

	function showLoading(trans) {
		if (trans) {
			$('#loadingTransactions').addClass('fa-spin');
			$('#loadingTransactions').addClass('dim');
			$('#loadingTransactions').prop('disabled', true);
			$('#loadingTransactions').show();
			$('#refreshButtonLoading').show();
			$('#refreshButtonSearch').hide();
			$("#findTransactions").hide();
		}
	}

	function buttonLoading(trans) {
		if (!publicAddr) {
			hideLoading(trans);
			return;
		}
		if (trans) {
			$('#loadingTransactions').removeClass('fa-spin');
			$('#loadingTransactions').removeClass('dim');
			$('#loadingTransactions').prop('disabled', false);
			if (publicAddr) {
				$("#findTransactions").show();
			}
			$('#loadingTransactions').show();
			$('#refreshButtonLoading').hide();
			$('#refreshButtonSearch').show();
		}
	}

	function hideLoading(trans) {
		if (!publicAddr) {
			trans = true;
		}

		if (trans) {
			$('#loadingTransactions').hide();
			$('#refreshButtonLoading').hide();
			$('#refreshButtonSearch').show();
			if (publicAddr) {
				$("#findTransactions").show();
			}
		}
	}

	function myClick() {
		if (running)
			requestID++;
		if (!initiated) {
			//autoStart = true;
			return;
		}

		hideError();
		hideHint();
		//disableInput(true);
		clearDownloads();

		// validate address
		if (!autoStart)
			publicAddr = getAddress();

		autoStart = false;
		if (publicAddr) {
			window.location.hash = publicAddr;
			getAll(false, requestID);
		}
		else {
			console.log('invalid input');
			disableInput(false);
			hideLoading(true);
		}
	}

	function getAll(autoload, rqid) {
		running = true;

		trigger1 = true;

		lastResult = undefined;

		if (publicAddr) {
			setStorage();
			window.location.hash = publicAddr;
			getTrans(rqid);
		} else {
			running = false;
		}
	}


	function getTrans(rqid) {


		if (!trigger1) {
			myClick(requestID);
			return;
		}

		trigger1 = false;
		loadedLogs = 0;
		displayedLogs = false;
		disableInput(true);
		blockReqs = 0;
		blockLoaded = 0;

		showLoading(true);

		$('#transactionsTable tbody').empty();
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

	// check if input address is valid
	function getAddress(addr) {

		setAddrImage('');
		document.getElementById('currentAddr').innerHTML = '0x......'; // side menu
		document.getElementById('currentAddr2').innerHTML = '0x......'; //top bar
		document.getElementById('currentAddrDescr').innerHTML = 'Input address';

		var address = '';
		address = addr ? addr : document.getElementById('address').value;
		address = address.trim();

		if (!_delta.web3.isAddress(address)) {
			//check if url ending in address
			if (address.indexOf('/0x') !== -1) {
				var parts = address.split('/');
				var lastSegment = parts.pop() || parts.pop();  // handle potential trailing slash
				if (lastSegment)
					address = lastSegment;
			}

			if (!_delta.web3.isAddress(address)) {
				if (address.length == 66 && address.slice(0, 2) === '0x') {
					// transaction hash, go to transaction details
					window.location = window.location.origin + window.location.pathname + '/../tx.html#' + address;
					return;
				}

				// possible private key, show warning   (private key, or tx without 0x)
				if (address.length == 64 && address.slice(0, 2) !== '0x') {
					if (!addr) // ignore if in url arguments
					{
						showError("You likely entered your private key, NEVER do that again");
					}
				}
				else if (address.length == 40 && address.slice(0, 2) !== '0x') {
					address = `0x${addr}`;

				}
				else {
					if (!addr) // ignore if in url arguments
					{
						showError("Invalid address, try again");
					}
					return undefined;
				}
				if (!_delta.web3.isAddress(address)) {
					if (!addr) // ignore if in url arguments
					{
						showError("Invalid address, try again");
					}
					return undefined;
				}
			}
		}

		$('#userToggle').removeClass('hidden');
		document.getElementById('address').value = address;
		document.getElementById('currentAddr').innerHTML = address.slice(0, 16); // side menu
		document.getElementById('currentAddr2').innerHTML = address.slice(0, 8); //top bar
		$('#walletInfo').removeClass('hidden');
		if (!savedAddr || address.toLowerCase() !== savedAddr.toLowerCase()) {
			$('#save').removeClass('hidden');
			$('#forget').addClass('hidden');
			if (savedAddr) {
				$('#savedSection').removeClass('hidden');
			}
		} else if (savedAddr && address.toLowerCase() === savedAddr.toLowerCase()) {
			$('#save').addClass('hidden');
			$('#forget').removeClass('hidden');
			$('#savedSection').addClass('hidden');
			if (savedAddr === metamaskAddr) {
				document.getElementById('currentAddrDescr').innerHTML = 'Metamask address (Saved)';
			} else {
				document.getElementById('currentAddrDescr').innerHTML = 'Saved address';
			}
		}
		if (metamaskAddr) {
			if (address.toLowerCase() === metamaskAddr.toLowerCase()) {
				if (metamaskAddr !== savedAddr)
					document.getElementById('currentAddrDescr').innerHTML = 'Metamask address';
				$('#metamaskSection').addClass('hidden');
			} else {
				$('#metamaskSection').removeClass('hidden');
			}
		}

		$('#etherscan').attr("href", _util.addressLink(address, false, false))
		document.getElementById('addr').innerHTML = _util.addressLink(address, true, false);
		setAddrImage(address);

		return address;
	}

	function setAddrImage(addr) {

		var icon = document.getElementById('addrIcon');
		var icon2 = document.getElementById('currentAddrImg');
		var icon3 = document.getElementById('userImage');

		if (addr) {
			icon.style.backgroundImage = 'url(' + blockies.create({ seed: addr.toLowerCase(), size: 8, scale: 16 }).toDataURL() + ')';
			var smallImg = 'url(' + blockies.create({ seed: addr.toLowerCase(), size: 8, scale: 4 }).toDataURL() + ')';
			icon2.style.backgroundImage = smallImg;
			icon3.style.backgroundImage = smallImg;
		} else {
			icon.style.backgroundImage = '';
			icon2.style.backgroundImage = '';
			icon3.style.backgroundImage = '';
		}
	}

	function setSavedImage(addr) {
		var icon = document.getElementById('savedImage');
		if (addr)
			icon.style.backgroundImage = 'url(' + blockies.create({ seed: addr.toLowerCase(), size: 8, scale: 4 }).toDataURL() + ')';
		else
			icon.style.backgroundImage = '';
	}

	function setMetamaskImage(addr) {
		var icon = document.getElementById('metamaskImage');
		if (addr)
			icon.style.backgroundImage = 'url(' + blockies.create({ seed: addr.toLowerCase(), size: 8, scale: 4 }).toDataURL() + ')';
		else
			icon.style.backgroundImage = '';
	}


	function changeTypes() {
		var mode = $('#typeSelect').val();
		mode = Number(mode);

		if (mode >= 0 && mode < 3)
			typeMode = mode;
		else
			mode = 0;
	}


	function setDaySelector() {
		useDaySelector = true;
		validateDays();
		$('#days').prop('disabled', false);
		$('#blockSelect1').prop('disabled', true);
		$('#blockSelect2').prop('disabled', true);
		$('#monthSelect').prop('disabled', true);

	}

	function setMonthSelector() {
		useDaySelector = false;
		checkMonthInput();
		$('#monthSelect').prop('disabled', false);
		$('#days').prop('disabled', true);
		$('#blockSelect1').prop('disabled', true);
		$('#blockSelect2').prop('disabled', true);
	}

	function setBlockSelector() {
		useDaySelector = false;
		$('#days').prop('disabled', true);
		$('#blockSelect1').prop('disabled', false);
		$('#blockSelect2').prop('disabled', false);
		$('#monthSelect').prop('disabled', true);

		$(".blockInput").attr({
			"max": blocknum,
			"min": minBlock,
			"step": 1,
		});

		if (!$('#blockSelect1').val())
			$('#blockSelect1').val(startblock);
		if (!$('#blockSelect2').val())
			$('#blockSelect2').val(blocknum);

		checkBlockInput();
	}


	function checkMonthInput() {
		let val = Number($('#monthSelect').val());

		if (val < 0) val = 0;
		if (val > _delta.config.blockMonths.length - 1) val = _delta.blockMonths.length - 1;

		startblock = _delta.config.blockMonths[val].blockFrom;
		endblock = _delta.config.blockMonths[val].blockTo;

		getStartBlock();
	}

	function checkBlockInput() {
		let block1 = Math.floor($('#blockSelect1').val());
		let block2 = Math.floor($('#blockSelect2').val());

		if (block1 > block2) // swap if values are wrong
		{
			block1 = Math.floor($('#blockSelect2').val());
			block2 = Math.floor($('#blockSelect1').val());
		}

		startblock = Math.max(minBlock, block1);
		endblock = Math.min(block2, blocknum);

		getStartBlock();
	}

	function getStartBlock() {
		if (useDaySelector) {
			startblock = Math.floor(blocknum - ((transactionDays * 24 * 60 * 60) / blocktime));
			startblock = Math.max(startblock, minBlock);
			endblock = blocknum;

		}

		$('#blockSelect1').val(startblock);
		$('#blockSelect2').val(endblock);

		$('#selectedBlocks').html('Selected block range: <a href="https://etherscan.io/block/' + startblock + '" target="_blank">' + startblock + '</a> - <a href="https://etherscan.io/block/' + endblock + '" target="_blank">' + endblock + '</a>');
		return startblock;
	}

	function validateDays() {
		let input = $('#days').val();
		input = parseFloat(input);
		var days = 1;
		if (input < 0.25)
			days = 0.25;
		else if (input > 100)
			days = 100;
		else
			days = input;

		transactionDays = days;
		getStartBlock();
		$('#days').val(days);
	}

	function setBlockProgress(loaded, max, trades, start, end) {
		let progressString = 'Loaded ' + loaded + '/' + max + ' blocks, found ' + trades + ' relevant transactions';
		$('#blockProgress').html(progressString);
	}


	function getTransactions(rqid) {

		var topics = [];
		if (typeMode == 0) {
			//for Kyber, add user topic to search for speedup
			if(historyConfig.userIndexed && historyConfig.userTopic == 1)
				topics = [historyConfig.tradeTopic, ("0x000000000000000000000000" + publicAddr.slice(2).toLowerCase())];
			else
				topics = [historyConfig.tradeTopic];
		}
		else if (typeMode == 1) {
			topics = [[historyConfig.depositTopic, historyConfig.withdrawTopic]];
		}
		else {
			topics = [[historyConfig.tradeTopic, historyConfig.depositTopic, historyConfig.withdrawTopic]];
		}

		var start = startblock;
		var end = endblock;
		const max = 5000;

		let totalBlocks = end - start + 1; //block 5-10 (inclusive) gives you 6 blocks

		loadedLogs = 0;
		let downloadedBlocks = 0;
		setBlockProgress(downloadedBlocks, totalBlocks, 0);

		var tradeLogResult = [];
		const contractAddr = _delta.config[historyConfig.exchangeAddr]; //_delta.config.contractEtherDeltaAddr.toLowerCase();

		var reqAmount = 0;
		for (var i = start; i <= end; i += (max + 1)) {
			reqAmount++;
		}
		var rpcId = 6;

		var activeRequests = 0;
		const maxRequests = 12;
		var activeStart = start;

		// repeat func until it returns false
		for (var i = 0; i < maxRequests; i++) {
			getBatchedLogs();
		}

		function getBatchedLogs() {
			if (activeRequests < maxRequests && activeStart <= end) {
				activeRequests++;
				let tempStart = activeStart;
				activeStart = tempStart + max + 1;
				getLogsInRange(tempStart, Math.min(tempStart + max, end), rpcId);
				rpcId++;
				return true;
			} else {
				return false;
			}

			function getLogsInRange(startNum, endNum, rpcID) {
				_util.getTradeLogs(_delta.web3, contractAddr, topics, startNum, endNum, rpcID, receiveLogs);
			}
		}

		/*	for (var i = start; i <= end; i += (max + 1)) {
				getLogsInRange(i, Math.min(i + max, end), rpcId);
				rpcId++;
			}
	
			function getLogsInRange(startNum, endNum, rpcID) {
				_util.getTradeLogs(_delta.web3, contractAddr, startNum, endNum, rpcID, receiveLogs);
			}
			*/

		function receiveLogs(logs, blockCount) {

			activeRequests--;
			getBatchedLogs();


			if (rqid <= requestID) {
				downloadedBlocks += blockCount;
				if (logs) {

					loadedLogs++;
					if (logs.length > 0) {
						var tradesInResult = parseOutput(logs);

						//get tx times

						var doneBlocks = {};
						for (var i = 0; i < tradesInResult.length; i++) {
							if (!blockDates[tradesInResult[i].Block] && !doneBlocks[tradesInResult[i].Block]) {
								uniqueBlocks[tradesInResult[i].Block] = 1;
								doneBlocks[tradesInResult[i].Block] = true;
								blockReqs++;

								// try getting block date from etherscan
								_util.getBlockDate(_delta.web3, tradesInResult[i].Block, (err, unixtimestamp, nr) => {

									if (err) {
										console.log(err);
										// etherscan fails, try web3 provider
										if (_delta.web3s.length > 1 && nr) {
											_util.getBlockDate(_delta.web3s[1], nr, (err2, unixtimestamp2, nr2) => {
												receiveDates(err2, unixtimestamp2, nr2);
											});
										}
									} else {
										receiveDates(err, unixtimestamp, nr);
									}

								});

								function receiveDates(err, unixtimestamp, nr) {
									if (!err && unixtimestamp) {
										blockDates[nr] = _util.toDateTime(unixtimestamp);
									}

									blockLoaded++;
									if (blockLoaded >= blockReqs) {
										setBlockStorage(); // update cached block dates
										if (!running)
											done();
									}
								}

							}
						}
						tradeLogResult = tradeLogResult.concat(tradesInResult);
					}
					done();
				} else {
					console.log('failed');
				}
			}
		}

		function done() {
			setBlockProgress(downloadedBlocks, totalBlocks, tradeLogResult.length);
			if (loadedLogs < reqAmount) {
				makeTable(tradeLogResult);
				return;
			}

			lastResult = tradeLogResult;
			displayedLogs = true;
			makeTable(lastResult);
		}

		function parseOutput(outputLogs) {
			var outputs = [];
			var myAddr = publicAddr.toLowerCase();
			var addrrr = myAddr.slice(2);

			let filteredLogs;
			
			//kyber check only topic1
			if(historyConfig == _delta.config.historyKyber){
				filteredLogs = outputLogs.filter((log) => {
					return log.topics[historyConfig.userTopic].indexOf(addrrr) !== -1;
				});
			} else {
				
				//airswap && 0x, check maker in topic and taker in data
				if(historyConfig == _delta.config.history0x || historyConfig == _delta.config.historyAirSwap) {
					filteredLogs = outputLogs.filter((log) => {
						return (log.data.indexOf(addrrr) !== -1 || log.topics[1].indexOf(addrrr) !== -1);
					});
				} 
				else {
					// etherdelta, token store, decentrex check maker/taker in data
					filteredLogs = outputLogs.filter((log) => {
						return log.data.indexOf(addrrr) !== -1;
					});
				}
			}
			

			//if from etherscan, timestamp is included
			// from web3/infura, no timestamp
			if (filteredLogs.length > 0 && filteredLogs[0].timeStamp && filteredLogs[0].blockNumber) {
				for (let i = 0; i < filteredLogs.length; i++) {
					let num = Number(filteredLogs[i].blockNumber);
					if (!blockDates[num]) {
						blockDates[num] = _util.toDateTime(filteredLogs[0].timeStamp);
					}
				}
			}

			let unpackedLogs = _util.processLogs(filteredLogs);

			for (let i = 0; i < unpackedLogs.length; i++) {

				let unpacked = unpackedLogs[i];
				if (!unpacked || unpacked.events.length < 4 || (unpacked.name != 'Trade' && unpacked.name != 'LogFill'  &&unpacked.name !== 'ExecuteTrade' && unpacked.name != 'Filled' && unpacked.name != 'Deposit' && unpacked.name != 'Withdraw')) {
					continue;
				}

				let obj = _delta.processUnpackedEvent(unpacked, myAddr);
				if (obj && !obj.error) {

					var obj2 = undefined;
					if (unpacked.name == 'Trade' || unpacked.name == 'LogFill' || unpacked.name == 'Filled' || unpacked.name == 'ExecuteTrade') {
						if (_util.isWrappedETH(obj.base.addr) || _util.isNonEthBase(obj.base.addr)) {
							obj2 = {
								Relayer: '',
								Type: obj.transType,
								Trade: obj.tradeType,
								Token: obj.token,
								Amount: obj.amount,
								Price: obj.price,
								Base: obj.base,
								Total: obj.baseAmount,
								Hash: filteredLogs[i].transactionHash,
								Date: '??', // retrieved by later etherscan call
								Block: _util.hexToDec(filteredLogs[i].blockNumber),
								Buyer: obj.buyer,
								Seller: obj.seller,
								Fee: (!obj.fee || !obj.fee.greaterThan(0)) ? 0 : obj.fee,
								FeeToken: obj.feeCurrency,
								'Fee in': obj.feeCurrency,
								Info: window.location.origin + window.location.pathname + '/../tx.html#' + filteredLogs[i].transactionHash,
								Unlisted: obj.unlisted,
							};

							if (unpacked.name == 'Filled' || unpacked.name == 'ExecuteTrade') {
								obj2.FeeToken = {name: '', addr: ''}; // make compatible with export
							} else if (obj.relayer) {
								obj2.Relayer = _util.relayName(obj.relayer);
							} else {
								delete obj2.Relayer;
							}
						}
					} else if (unpacked.name == 'Deposit' || unpacked.name == 'Withdraw') {
						obj2 = {
							Type: obj.type.replace('Token ', ''),
							Trade: '',
							Token: obj.token,
							Amount: obj.amount,
							Price: '',
							Base: '',
							Total: '',
							Hash: filteredLogs[i].transactionHash,
							Date: '??', // retrieved by later etherscan call
							Block: _util.hexToDec(filteredLogs[i].blockNumber),
							Buyer: '',
							Seller: '',
							Fee: '',
							FeeToken: '',
							'Fee in': '',
							Info: window.location.origin + window.location.pathname + '/../tx.html#' + filteredLogs[i].transactionHash,
							Unlisted: obj.unlisted,
						};
					}
					if (obj2)
						outputs.push(obj2);
				}
			} // for
			return outputs;
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


	function checkBlockDates(trades) {
		for (var i = 0; i < trades.length; i++) {
			if (blockDates[trades[i].Block]) {
				trades[i].Date = blockDates[trades[i].Block];
			}
		}
	}

	//balances table
	function makeTable(result) {
		checkBlockDates(result);
		$('#transactionsTable tbody').empty();
		var filtered = result;
		var loaded = tableLoaded;

		buildHtmlTable('#transactionsTable', filtered, loaded, tradeHeaders);
		trigger();
	}

	// save address for next time
	function setStorage() {
		if (typeof (Storage) !== "undefined") {
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

		}
	}

	function getStorage() {
		if (typeof (Storage) !== "undefined") {

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

	// final callback to sort table
	function trigger() {
		if (tableLoaded) // reload existing table
		{
			$("#transactionsTable").trigger("update", [true, () => { }]);
			$("#transactionsTable thead th").data("sorter", true);
			//$("table").trigger("sorton", [[0,0]]);

		} else {
			$("#transactionsTable thead th").data("sorter", true);
			let defaultSortIndex = 7;
			if (historyConfig.showRelayers)
				defaultSortIndex = 8;
			$("#transactionsTable").tablesorter({
				textExtraction: {
					2: function (node, table, cellIndex) { return $(node).find("a").text(); },
				},
				widgets: ['scroller'],
				widgetOptions: {
					scroller_height: 500,
				},
				sortList: [[defaultSortIndex, "d"]]
			});

			tableLoaded = true;
		}
		if (displayedLogs)
			trigger1 = true;


		if (trigger1) {
			disableInput(false);
			hideLoading(true);
			running = false;
			requestID++;
			buttonLoading(true);
			downloadAllTrades();
		}
		else {
			hideLoading(trigger1);
		}
		tableLoaded = true;
	}


	// Builds the HTML Table out of myList.
	function buildHtmlTable(selector, myList, loaded, headers) {
		var body = $(selector + ' tbody');
		var columns = addAllColumnHeaders(myList, selector, loaded, headers);

		for (var i = 0; i < myList.length; i++) {
			if (!showCustomTokens && myList[i].Unlisted)
				continue;
			var row$ = $('<tr/>');


			{
				for (var colIndex = 0; colIndex < columns.length; colIndex++) {
					var head = columns[colIndex];
					var cellValue = myList[i][head];

					if (cellValue === null) cellValue = "";


					if (head == 'Amount' || head == 'Price' || head == 'Fee' || head == 'Total') {
						if (head == 'Fee' && myList[i][columns[0]] != 'Taker') {
							cellValue = '';
						}

						if (cellValue !== "" && cellValue !== undefined) {
							var dec = fixedDecimals;
							if (head == 'Price')
								dec += 6;
							else if (head == 'Fee')
								dec += 2;
							var num = '<span data-toggle="tooltip" title="' + cellValue.toString() + '">' + cellValue.toFixed(dec) + '</span>';
							row$.append($('<td/>').html(num));
						}
						else {
							row$.append($('<td/>').html(cellValue));
						}
					}
					else if (head == 'Token' || head == 'Base' || head == 'Fee in') {
						if ((head == 'Fee in') && myList[i][columns[0]] != 'Taker') {
							cellValue = '';
						}

						if (cellValue !== "" && cellValue !== undefined) {

							let token = cellValue;
							let popoverContents = _delta.makePopoverContents(token);
							if (cellValue) {
								let labelClass = 'label-warning';
								if (!token.unlisted)
									labelClass = 'label-primary';

								row$.append($('<td/>').html('<a tabindex="0" class="label ' + labelClass + '" role="button" data-html="true" data-toggle="popover" data-placement="auto right"  title="' + token.name + '" data-container="body" data-content=\'' + popoverContents + '\'>' + token.name + '</a>'));
							}
						}
						else {
							row$.append($('<td/>').html(cellValue));
						}

					}
					else if (head == 'Type') {
						if (cellValue == 'Taker' || cellValue == 'Maker') {
							let contents = ''
							if (cellValue == 'Taker') {
								contents = '<span class="label label-info" >' + cellValue + '</span>';
							}
							else if (cellValue == 'Maker') {
								contents = '<span class="label label-default" >' + cellValue + '</span>';
							}

							if (myList[i].Trade == 'Buy') {
								contents += '<span class="label label-success" >' + myList[i].Trade + '</span>';
							}
							else if (myList[i].Trade == 'Sell') {
								contents += '<span class="label label-danger" >' + myList[i].Trade + '</span>';
							}
							row$.append($('<td/>').html(contents));

						} else if (cellValue == 'Deposit') {
							row$.append($('<td/>').html('<span class="label label-success" >' + cellValue + '</span>'));
						}
						else if (cellValue == 'Withdraw') {
							row$.append($('<td/>').html('<span class="label label-danger" >' + cellValue + '</span>'));
						} else {
							row$.append($('<td/>').html('<span>' + cellValue + '</span>'));
						}


					}
					else if (head == 'Hash') {
						row$.append($('<td/>').html(_util.hashLink(cellValue, true, true)));
					}
					else if (head == 'Block') {
						row$.append($('<td/>').html('<a target="_blank" href="https://etherscan.io/block/' + cellValue + '">' + cellValue + '</a>'));
					}
					else if (head == 'Buyer' || head == 'Seller') {
						let url = '';
						if (cellValue !== '')
							url = _util.addressLink(cellValue, true, true);
						row$.append($('<td/>').html(url));
					}
					else if (head == 'Date') {
						if (cellValue !== '??')
							cellValue = _util.formatDate(cellValue, false, true);
						row$.append($('<td/>').html(cellValue));
					}
					else if (head == 'Info') {

						row$.append($('<td/>').html('<a href="' + cellValue + '" target="_blank"><i class="fa fa-ellipsis-h"></i></a>'));
					}
					else {
						row$.append($('<td/>').html(cellValue));
					}
				}
			}

			body.append(row$);
			$('[data-toggle=tooltip]').tooltip({
				'placement': 'top',
				'container': 'body'
			});
			$("[data-toggle=popover]").popover();
		}
	}

	var tradeHeaders = { 'Type': 1, 'Token': 1, 'Amount': 1, 'Price': 1, 'Base': 1, 'Total': 1, 'Hash': 1, 'Date': 1, 'Buyer': 1, 'Seller': 1, 'Fee': 1, 'Fee in': 1, 'Block': 1, 'Info': 1 };
	// Adds a header row to the table and returns the set of columns.
	// Need to do union of keys from all records as some records may not contain
	// all records.
	function addAllColumnHeaders(myList, selector, loaded, headers) {
		var columnSet = {};

		if (!loaded)
			$(selector + ' thead').empty();

		var header1 = $(selector + ' thead');
		var headerTr$ = $('<tr/>');

		if (!loaded) {
			header1.empty();
		}

		for (var i = 0; i < myList.length; i++) {
			var rowHash = myList[i];
			for (var key in rowHash) {
				if (!columnSet[key] && (headers[key] || (historyConfig.showRelayers && key === 'Relayer'))) {
					columnSet[key] = 1;
					headerTr$.append($('<th/>').html(key));
				}
			}
		}
		if (!loaded) {
			header1.append(headerTr$);
			$(selector).append(header1);
		}
		columnSet = Object.keys(columnSet);
		return columnSet;
	}


	function fillMonthSelect() {
		var select = document.getElementById("monthSelect");

		//Create array of options to be added
		var array = _delta.config.blockMonths;

		var count = 0;
		//Create and append the options
		for (var i = 0; i < array.length; i++) {
			if (array[i].blockTo >= minBlock && (!historyConfig.maxBlock || array[i].blockFrom <= historyConfig.maxBlock)) {
				count++;
				var option = document.createElement("option");
				option.value = i;
				option.text = array[i].m;
				select.appendChild(option);
			}
		}
		select.selectedIndex = count - 1;
	}


	function clearDownloads() {
		$('#downloadTrades').html('');
		$('#downloadBitcoinTaxTrades').html('');
		$('#downloadCointrackingTrades').html('');
		$('#downloadCointracking2Trades').html('');

		$('#downloadFunds').html('');
		//	$('#downloadBitcoinTaxFunds').html('');
		$('#downloadCointrackingFunds').html('');
		//	$('#downloadCointracking2Funds').html('');
	}


	function downloadAllTrades() {
		if (lastResult) {
			checkBlockDates(lastResult);

			if (typeMode != 1) {
				downloadTrades();
				downloadBitcoinTaxTrades();
				downloadCointrackingTrades();
				downloadCointracking2Trades();
			}
			if (typeMode > 0) {
				downloadFunds();
				downloadCointrackingFunds();
			}
		}




		function downloadTrades() {
			//if(lastResult)
			{
				var allTrades = lastResult.filter((x) => { return (x.Type == 'Maker' || x.Type == 'Taker'); });

				var A = [['Type', 'Trade', 'Token', 'Amount', 'Price', 'BaseCurrency', 'Total', 'Date', 'Block', 'Transaction Hash', 'Buyer', 'Seller', 'Fee', 'FeeToken', 'Token Contract', 'BaseCurrency Contract', 'Exchange']];
				// initialize array of rows with header row as 1st item
				for (var i = 0; i < allTrades.length; ++i) {

					let exchange = historyConfig.exchange;
					if (allTrades[i].Relayer) {
						exchange = allTrades[i].Relayer;
					}

					var arr = [allTrades[i]['Type'], allTrades[i]['Trade'], allTrades[i]['Token'].name, allTrades[i]['Amount'], allTrades[i]['Price'], allTrades[i]['Base'].name,
					allTrades[i]['Total'], _util.formatDateOffset(allTrades[i]['Date']), allTrades[i]['Block'], allTrades[i]['Hash'], allTrades[i]['Buyer'], allTrades[i]['Seller'],
					allTrades[i]['Fee'], allTrades[i]['FeeToken'].name, allTrades[i]['Token'].addr, allTrades[i]['Base'].addr, exchange];

					for (let j = 0; j < arr.length; j++) {
						//remove exponential notation
						if (A[0][j] == 'Amount' || A[0][j] == 'Price' || A[0][j] == 'Total ETH' || A[0][j] == 'Fee') {
							if (arr[j])
								arr[j] = _util.exportNotation(arr[j]);
						}

						// add quotes
						//arr[j] = `\"${arr[j]}\"`;
					}
					A.push(arr);
				}


				var csvRows = [];
				for (var i = 0, l = A.length; i < l; ++i) {
					csvRows.push(A[i].join(','));   // unquoted CSV row
				}
				var csvString = csvRows.join("\r\n");

				var sp = document.createElement('span');
				sp.innerHTML = " ";
				var a = document.createElement('a');
				a.innerHTML = '<i class="fa fa-download" aria-hidden="true"></i>';
				a.href = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvString);
				a.target = '_blank';
				a.download = historyConfig.exchange + "_Trades_" + _util.formatDate(_util.toDateTimeNow(true), true) + '_' + publicAddr + ".csv";
				sp.appendChild(a);

				$('#downloadTrades').html('');
				var parent = document.getElementById('downloadTrades');
				parent.appendChild(sp);
				//parent.appendCild(a);

			}
		}

		function downloadFunds() {
			//if(lastResult)
			{
				var allTrades = lastResult.filter((x) => { return (x.Type == 'Deposit' || x.Type == 'Withdraw'); });

				var A = [['Type', 'Token', 'Amount', 'Date', 'Block', 'Transaction Hash', 'Token Contract', 'Exchange']];
				// initialize array of rows with header row as 1st item
				for (var i = 0; i < allTrades.length; ++i) {

					let exchange = historyConfig.exchange;
					if (allTrades[i].Relayer) {
						exchange = allTrades[i].Relayer;
					}
					var arr = [allTrades[i]['Type'], allTrades[i]['Token'].name, allTrades[i]['Amount'], _util.formatDateOffset(allTrades[i]['Date']),
					allTrades[i]['Block'], allTrades[i]['Hash'], allTrades[i]['Token'].addr, exchange];

					for (let j = 0; j < arr.length; j++) {
						//remove exponential notation
						if (A[0][j] == 'Amount') {
							if (arr[j])
								arr[j] = _util.exportNotation(arr[j]);
						}

						// add quotes
						//arr[j] = `\"${arr[j]}\"`;
					}
					A.push(arr);
				}


				var csvRows = [];
				for (var i = 0, l = A.length; i < l; ++i) {
					csvRows.push(A[i].join(','));   // unquoted CSV row
				}
				var csvString = csvRows.join("\r\n");

				var sp = document.createElement('span');
				sp.innerHTML = " ";
				var a = document.createElement('a');
				a.innerHTML = '<i class="fa fa-download" aria-hidden="true"></i>';
				a.href = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvString);
				a.target = '_blank';
				a.download = historyConfig.exchange + "_Funds_" + _util.formatDate(_util.toDateTimeNow(true), true) + '_' + publicAddr + ".csv";
				sp.appendChild(a);

				$('#downloadFunds').html('');
				var parent = document.getElementById('downloadFunds');
				parent.appendChild(sp);
				//parent.appendCild(a);

			}
		}

		function downloadBitcoinTaxTrades() {
			//if(lastResult)
			{
				//checkBlockDates(lastResult);
				var allTrades = lastResult.filter((x) => { return (x.Type == 'Maker' || x.Type == 'Taker'); });

				var A = [['Date', 'Action', 'Source', 'Volume', 'Symbol', 'Price', 'Currency', 'Fee', 'FeeCurrency', 'Memo']];

				// initialize array of rows with header row as 1st item
				for (var i = 0; i < allTrades.length; ++i) {
					var arr = undefined;
					var memoString = '"Transaction Hash ' + allTrades[i]['Hash'] + " -- " + allTrades[i]['Token'].name + " token contract " + allTrades[i]['Token'].addr + '"';

					let exchange = historyConfig.exchange;
					if (allTrades[i].Relayer) {
						exchange = allTrades[i].Relayer;
					}

					//if (allTrades[i]['Trade'] === 'Buy') {
					arr = [_util.formatDateOffset(allTrades[i]['Date']), allTrades[i]['Trade'].toUpperCase(), exchange, allTrades[i]['Amount'], allTrades[i]['Token'].name, allTrades[i]['Price'], allTrades[i]['Base'].name,
					allTrades[i]['Fee'], allTrades[i]['FeeToken'].name, memoString];
					//	}
					// add token fee to total for correct balance in bitcoin tax
					//	else {
					//		arr = [_util.formatDateOffset(allTrades[i]['Date']), allTrades[i]['Trade'].toUpperCase(), exchange, allTrades[i]['Amount'] + allTrades[i]['Fee'], allTrades[i]['Token'].name, allTrades[i]['Price'], allTrades[i]['Base'].name,
					//		allTrades[i]['Fee'], allTrades[i]['FeeToken'].name, memoString];
					//	}

					for (let j = 0; j < arr.length; j++) {
						//remove exponential notation
						if (A[0][j] == 'Volume' || A[0][j] == 'Price' || A[0][j] == 'Fee' || A[0][j] == 'Total') {
							if (arr[j])
								arr[j] = _util.exportNotation(arr[j]);
						}

						// add quotes
						//arr[j] = `\"${arr[j]}\"`;
					}
					A.push(arr);
				}
				var csvRows = [];
				for (var i = 0, l = A.length; i < l; ++i) {
					csvRows.push(A[i].join(','));   // unquoted CSV row
				}
				var csvString = csvRows.join("\r\n");

				var sp = document.createElement('span');
				sp.innerHTML = " ";
				var a = document.createElement('a');
				a.innerHTML = '<i class="fa fa-download" aria-hidden="true"></i>';
				a.href = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvString);
				a.target = '_blank';
				a.download = 'BitcoinTax_' + historyConfig.exchange + '_' + _util.formatDate(_util.toDateTimeNow(true), true) + '_' + publicAddr + ".csv";
				sp.appendChild(a);

				$('#downloadBitcoinTaxTrades').html('');
				var parent = document.getElementById('downloadBitcoinTaxTrades');
				parent.appendChild(sp);
				//parent.appendCild(a);

			}

		}

		//csv columns
		function downloadCointrackingTrades() {
			//if(lastResult)
			{
				//checkBlockDates(lastResult);
				var allTrades = lastResult.filter((x) => { return (x.Type == 'Maker' || x.Type == 'Taker'); });

				var A = [['\"Type\"', '\"Buy\"', '\"Cur.\"', '\"Sell\"', '\"Cur.\"', '\"Fee\"', '\"Cur.\"', '\"Exchange\"', '\"Group\"', '\"Comment\"', '\"Trade ID\"', '\"Date\"']];
				// initialize array of rows with header row as 1st item
				for (var i = 0; i < allTrades.length; ++i) {
					var arr = [];
					let exchange = historyConfig.exchange;
					if (allTrades[i].Relayer) {
						exchange = allTrades[i].Relayer;
					}

					if (allTrades[i]['Trade'] === 'Buy') { //buy add fee to eth total
						arr = ['Trade', allTrades[i]['Amount'], allTrades[i]['Token'].name, allTrades[i]['Total'].plus(allTrades[i]['Fee']), allTrades[i]['Base'].name, allTrades[i]['Fee'], allTrades[i]['FeeToken'].name,
							exchange, '', 'Hash: ' + allTrades[i]['Hash'] + " -- " + allTrades[i]['Token'].name + " token contract " + allTrades[i]['Token'].addr, allTrades[i]['Hash'], _util.formatDateOffset(allTrades[i]['Date'])];

					}
					else {  //sell add fee to token total
						arr = ['Trade', allTrades[i]['Total'], allTrades[i]['Base'].name, allTrades[i]['Amount'].plus(allTrades[i]['Fee']), allTrades[i]['Token'].name, allTrades[i]['Fee'], allTrades[i]['FeeToken'].name,
							exchange, '', 'Hash: ' + allTrades[i]['Hash'] + " -- " + allTrades[i]['Token'].name + " token contract " + allTrades[i]['Token'].addr, allTrades[i]['Hash'], _util.formatDateOffset(allTrades[i]['Date'])];
					}

					for (let j = 0; j < arr.length; j++) {
						//remove exponential notation
						if (A[0][j] == '\"Buy\"' || A[0][j] == '\"Sell\"' || A[0][j] == '\"Fee\"') {
							if (arr[j])
								arr[j] = _util.exportNotation(arr[j]);
						}

						// add quotes
						arr[j] = `\"${arr[j]}\"`;
					}

					A.push(arr);
				}
				var csvRows = [];
				for (var i = 0, l = A.length; i < l; ++i) {
					csvRows.push(A[i].join(','));   // unquoted CSV row
				}
				var csvString = csvRows.join("\r\n");

				var sp = document.createElement('span');
				sp.innerHTML = " ";
				var a = document.createElement('a');
				a.innerHTML = '<i class="fa fa-download" aria-hidden="true"></i>';
				a.href = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvString);
				a.target = '_blank';
				a.download = 'Cointracking_CSV_' + historyConfig.exchange + '_' + _util.formatDate(_util.toDateTimeNow(true), true) + '_' + publicAddr + ".csv";
				sp.appendChild(a);

				$('#downloadCointrackingTrades').html('');
				var parent = document.getElementById('downloadCointrackingTrades');
				parent.appendChild(sp);
				//parent.appendCild(a);
			}
		}

		//csv columns
		function downloadCointrackingFunds() {
			//if(lastResult)
			{
				//checkBlockDates(lastResult);
				var allTrades = lastResult.filter((x) => { return (x.Type == 'Deposit' || x.Type == 'Withdraw'); });

				var A = [['\"Type\"', '\"Buy\"', '\"Cur.\"', '\"Sell\"', '\"Cur.\"', '\"Fee\"', '\"Cur.\"', '\"Exchange\"', '\"Group\"', '\"Comment\"', '\"Trade ID\"', '\"Date\"']];
				// initialize array of rows with header row as 1st item
				for (var i = 0; i < allTrades.length; ++i) {
					var arr = [];
					let exchange = historyConfig.exchange;
					if (allTrades[i].Relayer) {
						exchange = allTrades[i].Relayer;
					}

					if (allTrades[i]['Type'] === 'Deposit') { // deposit is 'buy'
						arr = ['Deposit', allTrades[i]['Amount'], allTrades[i]['Token'].name, "", "", "", "",
							exchange, '', 'Hash: ' + allTrades[i]['Hash'] + " -- " + allTrades[i]['Token'].name + " token contract " + allTrades[i]['Token'].addr,
							allTrades[i]['Hash'], _util.formatDateOffset(allTrades[i]['Date'])];
					}
					else {  //withdraw is 'sell'
						arr = ['Withdrawal', "", "", allTrades[i]['Amount'], allTrades[i]['Token'].name, "", "",
							exchange, '', 'Hash: ' + allTrades[i]['Hash'] + " -- " + allTrades[i]['Token'].name + " token contract " + allTrades[i]['Token'].addr,
							allTrades[i]['Hash'], _util.formatDateOffset(allTrades[i]['Date'])];
					}

					for (let j = 0; j < arr.length; j++) {
						//remove exponential notation
						if (A[0][j] == '\"Buy\"' || A[0][j] == '\"Sell\"') {
							if (arr[j])
								arr[j] = _util.exportNotation(arr[j]);
						}

						// add quotes
						arr[j] = `\"${arr[j]}\"`;
					}

					A.push(arr);
				}
				var csvRows = [];
				for (var i = 0, l = A.length; i < l; ++i) {
					csvRows.push(A[i].join(','));   // unquoted CSV row
				}
				var csvString = csvRows.join("\r\n");

				var sp = document.createElement('span');
				sp.innerHTML = " ";
				var a = document.createElement('a');
				a.innerHTML = '<i class="fa fa-download" aria-hidden="true"></i>';
				a.href = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvString);
				a.target = '_blank';
				a.download = 'CointrackingFunds_CSV_' + historyConfig.exchange + '_' + _util.formatDate(_util.toDateTimeNow(true), true) + '_' + publicAddr + ".csv";
				sp.appendChild(a);

				$('#downloadCointrackingFunds').html('');
				var parent = document.getElementById('downloadCointrackingFunds');
				parent.appendChild(sp);
				//parent.appendCild(a);
			}
		}

		//custom exchange columns
		function downloadCointracking2Trades() {
			//if(lastResult)
			{
				//checkBlockDates(lastResult);
				var allTrades = lastResult.filter((x) => { return (x.Type == 'Maker' || x.Type == 'Taker'); });

				var A = [['\"Date\"', '\"Buy\"', '\"Cur.\"', '\"Sell\"', '\"Cur.\"', '\"Fee\"', '\"Cur.\"', '\"Trade ID\"', '\"Comment\"', '\"Exchange\"', '\"Type\"']];

				// initialize array of rows with header row as 1st item
				for (var i = 0; i < allTrades.length; ++i) {
					var arr = [];
					let exchange = historyConfig.exchange;
					if (allTrades[i].Relayer) {
						exchange = allTrades[i].Relayer;
					}
					if (allTrades[i]['Trade'] === 'Buy') { //buy add fee to eth total
						arr = [_util.formatDateOffset(allTrades[i]['Date']), allTrades[i]['Amount'], allTrades[i]['Token'].name, allTrades[i]['Total'].plus(allTrades[i]['Fee']), allTrades[i]['Base'].name, allTrades[i]['Fee'], allTrades[i]['FeeToken'].name,
						allTrades[i]['Hash'], 'Hash: ' + allTrades[i]['Hash'] + " -- " + allTrades[i]['Token'].name + " token contract " + allTrades[i]['Token'].addr, exchange, 'Trade'];

					}
					else { //sell add fee to token total
						arr = [_util.formatDateOffset(allTrades[i]['Date']), allTrades[i]['Total'], allTrades[i]['Base'].name, allTrades[i]['Amount'].plus(allTrades[i]['Fee']), allTrades[i]['Token'].name, allTrades[i]['Fee'], allTrades[i]['FeeToken'].name,
						allTrades[i]['Hash'], 'Hash: ' + allTrades[i]['Hash'] + " -- " + allTrades[i]['Token'].name + " token contract " + allTrades[i]['Token'].addr, exchange, 'Trade'];
					}

					for (let j = 0; j < arr.length; j++) {
						//remove exponential notation
						if (A[0][j] == '\"Buy\"' || A[0][j] == '\"Sell\"' || A[0][j] == '\"Fee\"') {
							if (arr[j])
								arr[j] = _util.exportNotation(arr[j]);
						}

						// add quotes
						arr[j] = `\"${arr[j]}\"`;
					}
					A.push(arr);
				}
				var csvRows = [];
				for (var i = 0, l = A.length; i < l; ++i) {
					csvRows.push(A[i].join(','));   // unquoted CSV row
				}
				var csvString = csvRows.join("\r\n");

				var sp = document.createElement('span');
				sp.innerHTML = " ";
				var a = document.createElement('a');
				a.innerHTML = '<i class="fa fa-download" aria-hidden="true"></i>';
				a.href = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvString);
				a.target = '_blank';
				a.download = 'Cointracking_Custom_' + historyConfig.exchange + '_' + _util.formatDate(_util.toDateTimeNow(true), true) + '_' + publicAddr + ".csv";
				sp.appendChild(a);

				$('#downloadCointracking2Trades').html('');
				var parent = document.getElementById('downloadCointracking2Trades');
				parent.appendChild(sp);
				//parent.appendCild(a);

			}

		}
	}

	function placeholderTable() {
		var result = transactionsPlaceholder;
		makeTable(result);
	}

	function forget() {
		if (publicAddr) {
			if (publicAddr.toLowerCase() === savedAddr.toLowerCase()) {
				savedAddr = '';
				$('#savedSection').addClass('hidden');
			}
		}
		$('#address').val('');
		publicAddr = getAddress('');
		setStorage();
		window.location.hash = "";
		$('#walletInfo').addClass('hidden');
		if (!publicAddr && !savedAddr && !metamaskAddr) {
			$('#userToggle').click();
			$('#userToggle').addClass('hidden');
		}
		//myClick();

		return false;
	}

	function save() {
		savedAddr = publicAddr;
		publicAddr = getAddress(savedAddr);

		$('#savedAddress').html(savedAddr.slice(0, 16));
		$('#savedSection').addClass('hidden');
		$('#save').addClass('hidden');
		setSavedImage(savedAddr);
		setStorage();

		return false;
	}

	function loadSaved() {
		if (savedAddr) {

			publicAddr = savedAddr;
			publicAddr = getAddress(savedAddr);
			window.location.hash = savedAddr;
			$('#forget').removeClass('hidden');
			//myClick();
			setStorage();
		}
		return false;
	}

	function loadMetamask() {
		if (metamaskAddr) {
			publicAddr = metamaskAddr;
			publicAddr = getAddress(metamaskAddr);
			window.location.hash = metamaskAddr;
			$('#metamaskSection').addClass('hidden');
			setStorage();
			//myClick();
		}
		return false;
	}

}