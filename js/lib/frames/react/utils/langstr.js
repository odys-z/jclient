/**
 * A dynamic extending {string-key: parameterized-instance} translation mapper.
 * function:
 * use string template as resource key;
 * accept object as arguments
 * extending &amp; resolve un-mapped string template.
 */
export const Langstrs = {
	s: {
		'en': new Set(),
		'zh': { },
		'ja': { },
	},

	lang: 'en',

	using: function (lang = 'en') {
		Langstrs.lang = lang;
		if (! lang in Langstrs.s)
			Langstrs.s[lang] = {};
	},

	report: function (lang = 'zh') {
		let res = new Set();
		Langstrs.s.en.forEach( (v) => {
			if (!(v in Langstrs.s[lang]))
				res.add(v);
		} );
		return res;
	}
}

const argex = /{(\s*(\w|\d)*\s*)}/g;

/**var L = require('language');
 * or import L from Langstr;
 * Usage:
 * Langstrs.using('en'); // optional, default en
 * var the_string = L('Welcome {name}', {name: 'Joe'});
 * see https://stackoverflow.com/a/30191493/7362888
 * and https://stackoverflow.com/a/57882370/7362888
 */
export function L(t, o) {
	// map t first
	if (! (t in Langstrs.s[Langstrs.lang]) )
		if (Langstrs.lang !== 'en')
			; // Langstrs.s[Langstrs.lang][t] = t;
		else
			Langstrs.s.en.add(t);
	else t = Langstrs.lang === 'en' ?
		 t : Langstrs.s[Langstrs.lang][t];

	if (o)
		return replaceArg(t, o);
	else
		return t;

	function replaceArg(t, args) {
		// let m = argex.exec(t);
		if (t)
			t = t.replace(argex,
				function(match, argname) {
					return typeof args[argname] != 'undefined'
						? args[argname]
						: match ;
				});
		return t;
	}
}

/** return a promise
 *
 *  memo: navigator clipboard api needs a secure context (https)
 * @param {string} textToCopy text to be copied
 * https://stackoverflow.com/a/65996386/7362888
 */
export function copyToClipboard(textToCopy) {
	if (navigator.clipboard && window.isSecureContext) {
	    return navigator.clipboard.writeText(textToCopy);
	} else {
	    let textArea = document.createElement("textarea");
	    textArea.value = textToCopy;

	    // textArea.style.position = "fixed";
	    // textArea.style.left = "-999999px";
	    // textArea.style.top = "-999999px";
		textArea.style.display = "none";
	    document.body.appendChild(textArea);
	    textArea.focus();
	    textArea.select();
	    return new Promise((res, rej) => {
	        document.execCommand('copy') ? res() : rej();
	        textArea.remove();
	    });
	}
}
