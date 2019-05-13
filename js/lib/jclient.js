import $ from 'jquery';
import AES from './aes.js';
import {Protocol, JMessage, JHeader, SessionReq, QueryReq, UpdateReq, DeleteReq, InsertReq, DatasetCfg} from './protocol.js';

/**AES lib instance*/
var aes;

/**Jclient.js API
 * Java equivalent of
 * io.odysz.jclient.Clients;
 * io.odysz.jclient.SessionClient;
 */
class J {
	/**@param {string} serv serv path root, e.g. 'http://localhost/semantic-jserv'
	 */
	constructor (urlRoot) {
	 	this.cfg = {
			connId: null,
			verbose: true,
			defaultServ: urlRoot,
		}
		aes = new AES();
	}

	servUrl (port) {
		// This is a common error in jeasy frame
		if (port === undefined || port === null) {
			console.error("Port is null!");
			return;
		}

		// Protocol can't visited when debugging, but working:
		// console.log(Protocol.Port);
		// console.log("Protocol.Port[" + port + "] : " + Protocol.Port[port]);

		var ulr;
		if (Protocol.Port[port] !== undefined)
			ulr = this.cfg.defaultServ + '/'
				+ Protocol.Port[port]; // + '?conn=' + this.cfg.connId;
		else
			ulr = this.cfg.defaultServ + '/'
				+ port; // + '?conn=' + this.cfg.connId;

		if (this.cfg.connId)
			ulr += '?conn=' + this.cfg.connId;

		return ulr;
	}

	init (urlRoot, connId) {
		this.cfg.cconnId = connId;
		this.cfg.defaultServ = urlRoot;
	}

	understandPorts (newPorts) {
		Object.assign(Protocol.Port, newPorts);
	}

	opts(options) {
		Protocol.opts(options);
	}

	port(name) {
		return Protocol.Port[name];
	}

	login (usrId, pswd, onLogin, onError) {
		// byte[] iv =   AESHelper.getRandom();
		// String iv64 = AESHelper.encode64(iv);
		// String tk64 = AESHelper.encrypt(uid, pswdPlain, iv);
		console.log('J.login(' + usrId + ', ' + pswd + ', ...)');

		var iv = aes.getIv128();
		var c = aes.encrypt(usrId, pswd, iv);
		// var qobj = formatLogin(logId, c, bytesToB64(iv));
		var req = Protocol.formatSessionLogin(usrId, c, aes.bytesToB64(iv));
		var J = this;

		this.post(req,
			/**@param {object} resp
			 * code: "ok"
			 * data: Object { uid: "admin", ssid: "3sjUJk2JszDm", "user-name": "admin" }
			 * port: "session"
			 */
			function(resp) {
				var sessionClient = new SessionClient(resp.data, iv, true);
				sessionClient.J = J;
				if (typeof onLogin === "function")
					onLogin(sessionClient);
				else console.log(sessionClient);
			},
			onError);
	}

	static checkResponse(resp) {
		if (typeof resp === "undefined" || resp === null || resp.length < 2)
			return "err_NA";
		else return false;
	}

	post (jreq, onOk, onErr) {
		if (jreq === undefined) {
			console.error('jreq is null');
			return;
		}
		var url = this.servUrl(jreq.port);

		$.ajax({type: 'POST',
				// url: this.cfg.defaultServ + "/query.serv?page=" + pgIx + "&size=" + pgSize,
				url: url,
				contentType: "application/json; charset=utf-8",
				crossDomain: true,
				//xhrFields: { withCredentials: true },
				data: JSON.stringify(jreq),
				success: function (resp) {
					// response Content-Type = application/json;charset=UTF-8
					// code != ok
					if (resp.code !== Protocol.MsgCode.ok)
						if (typeof onErr === "function")
							onErr(resp.code, resp);
						else console.error(resp);
					// code == ok
					else {
						if (typeof onOk === "function")
							onOk(resp);
						else console.log(resp);
					}
				},
				error: function (resp) {
					if (typeof onErr === "function")
						onErr(Protocol.MsgCode.exIo, resp);
					else {
						console.error("ajax error:", url);
						console.error("req", jreq);
						console.error("response", resp);
					}
				}
			});
	}

	// TODO moved to protocol.js?
	respCols(resp) {
		return resp !== null && resp !== undefined && resp.code === "ok"
			? resp.data.rs[0][0] : [];
	}

	respRows(resp) {
		return resp !== null && resp !== undefined && resp.code === "ok"
			? resp.data.rs[0].slice(1) : [];
	}

	respObjs(resp, start, len) {
		var cols = this.respCols(resp);

		if (typeof start !== 'Number')
			start = 1;
		// start from 0
		else start++;

		if (typeof len !== 'Number')
			len = resp.data.rs[0].length - 1;
		else
			len = Math.min(len, resp.data.rs[0].length - 1 - start);

		var objs = [];
		for (var rx = start; rx < start + len; rx++) {
			var obj = {};
			for (var cx = 0; cx < cols.length; cx++)
				obj[cols[cx]] = resp.data.rs[0][rx][cx];
			objs.push(obj);
		}
		return objs;
	}
}

export const _J = new J();

/**Client with session logged in.*/
class SessionClient {
	static get ssInfo() { return "ss-info"; }

	/**Create SessionClient with credential information or load from localStorage.<br>
	 * Because of two senarios of login / home page integration, there are 2 typical useses:<br>
	 * Use Case 1 (persisted): logged in, then create a client with response,
	 * 		save in local storage, then load it in new page.<br>
	 * Use Case 1 (not persisted): logged in, then create a client with response,
	 * 		user's app handled the object, then provided to other functions,<br>
	 * 		typicall a home.vue component.<br>
	 * <p><b>Note</b></p>
	 * <p>Local storage may be sometimes confusing if not familiar with W3C standars.<br>
	 * The local storage can't be cross domain referenced. It's can not been loaded by home page
	 * if you linked from login page like this, as showed by this example in login.vue:</p>
	 * <p>window.top.location = response.home</p>
	 * <p>One recommended practice is initializing home.vue with login credential
	 * by login.vue, in app.vue.</p>
	 * <p>But this design makes home page and login component integrated. It's not
	 * friedly to application pattern like a port page with login which is independent
	 * to the system background home page.</p>
	 * <p>How should this pattern can be improved is open for discussion.
	 * If your are interested in this subject, leave any comments in wiki page please.</p>
	 * @param {object} ssInf login response form server: {ssid, uid}
	 * @param {byte[]} iv iv used for cipher when login.
	 * @param {boolean} dontPersist don't save into local storage.
	 */
	constructor (ssInf, iv, dontPersist) {
		if (ssInf) {
			// logged in, create from credential
			this.ssInf = ssInf;
			this.ssInf.iv = aes.bytesToB64(iv);
			if (!dontPersist) {
				var infStr = JSON.stringify(this.ssInf);
				localStorage.setItem(SessionClient.ssInfo, infStr);
			}
		}
		else {
			// jumped, create from local storage
			var sstr = localStorage.getItem(SessionClient.ssInfo);
			if (sstr) {
				this.ssInf = JSON.parse(sstr);
				this.ssInf.iv = aes.b64ToBytes(this.ssInf.iv);
			}
			else
				console.error("Can't find credential in local storage. SessionClient creating failed.");
		}

		this.J = _J;
	}

	/**Post the request message (JMessage with body of subclass of JBody).
	 * @param {JMessage} jmsg request message
	 * @param {function} onOk
	 * @param {function} onError
	 */
	commit(jmsg, onOk, onError) {
		this.J.post(jmsg, onOk, onError);
	}

	/**
	 * create a query message.
	 * @param {string} conn connection id
	 * @param {string} maintbl target table
	 * @param {string} alias target table alias
	 * @param {Object} pageInf<br>
	 * page: page index, -1 for no paging<br>
	 * size: page size, default 20, -1 for no paging
	 * @param {Object} act user's action for logging<br>
	 * {func, cate, cmd, remarks};
	 * @return {JMessage} the request message
	 */
	query(conn, maintbl, alias, pageInf, act) {
		var qryItem = new QueryReq(conn, maintbl, alias, pageInf);
		var header = Protocol.formatHeader(this.ssInf);
		if (typeof act === 'object') {
			header.act = act;
			this.usrAct(act.func, act.cate, act.cmd, act.remarks);
		}
		else
			header.userAct({func: 'query',
						cmd: 'select',
						cate: 'r',
						remarks: 'session query.serv'});
		var jreq = new JMessage(Protocol.Port.query, header, qryItem);
		return jreq;
	}

	update(conn, maintbl, pk, nvs) {
		if (this.currentAct === undefined || this.currentAct.func === undefined)
			console.error("jclient is designed to support user updating log natively, User action with function Id shouldn't ignored.",
						"To setup user's action information, call ssClient.usrAct().");

		if (pk === undefined) {
			console.error("To update a table, {pk, v} must presented.", pk);
			return;
		}

		var upd = new UpdateReq(conn, maintbl, pk);
		upd.a = Protocol.CRUD.u;
		this.currentAct.cmd = 'update';
		var jmsg = this.userReq(conn, Protocol.Port.update, upd, this.currentAct);

		if (nvs !== undefined) {
			if (Array.isArray(nvs))
				upd.nv(nvs);
			else console.error("updating nvs must be an array of name-value.", nvs)
		}
		return jmsg;
	}

	insert(conn, maintbl, nvs) {
		if (this.currentAct === undefined || this.currentAct.func === undefined)
			console.error("jclient is designed to support user updating log natively, User action with function Id shouldn't ignored.",
						"To setup user's action information, call ssClient.usrAct().");

		var ins = new InsertReq(conn, maintbl);
		// ins.a = Protocol.CRUD.c;
		this.currentAct.cmd = 'insert';
		var jmsg = this.userReq(conn, Protocol.Port.insert, ins, this.currentAct);

		if (nvs !== undefined) {
			if (Array.isArray(nvs))
				ins.valus(nvs);
			else console.error("updating nvs must be an array of name-value.", nvs)
		}
		return jmsg;
	}

	delete(conn, maintbl, pk) {
		if (this.currentAct === undefined || this.currentAct.func === undefined)
			console.error("jclient is designed to support user updating log natively, User action with function Id shouldn't ignored.",
						"To setup user's action information, call ssClient.usrAct().");
		if (pk === undefined) {
			console.error("To delete a table, {pk, v} must presented.", pk);
			return;
		}
		if (maintbl === undefined || maintbl === null || maintabl === "") {
			console.error("To delete a table, maintbl must presented.");
			return;
		}

		var upd = new UpdateReq(conn, maintbl, pk);
		upd.a = Protocol.CRUD.d;
		this.currentAct.cmd = 'delete';
		var jmsg = this.userReq(conn, Protocol.Port.update, upd, this.currentAct);
		return jmsg;
	}

	userReq(conn, port, bodyItem, act) {
		var header = Protocol.formatHeader(this.ssInf);
		if (typeof act === 'object') {
			header.userAct = act;
			this.usrAct(act.func, act.cate, act.cmd, act.remarks);
		}
		return new JMessage(port, header, bodyItem);
	}

	usrAct(funcId, cate, cmd, remarks) {
		if (this.currentAct === undefined)
			this.currentAct = {};
		Object.assign(this.currentAct,
			{func: funcId, cate: cate, cmd: cmd, remarks: remarks});
	}

	usrCmd(cmd) {
		if (this.currentAct === undefined)
			this.currentAct = {};
		this.currentAct.cmd = cmd;
	}

	commit (jmsg, onOk, onErr) {
		_J.post(jmsg, onOk, onErr);
	}
}

/**Client without session information.
 * This is needed for some senarios like rigerstering new account.*/
class Inseclient {
}

export * from './protocol.js';
export * from './frames/cheapflow/cheap-client.js';
export {J, SessionClient, Inseclient};
