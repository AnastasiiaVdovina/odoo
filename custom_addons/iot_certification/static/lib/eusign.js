//================================================================================

/**
 * Модуль, що підключається для взаємодії з iframe SignWidget
 */

//================================================================================

(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		define([], factory);
	} else if (typeof module === 'object' && module.exports) {
		module.exports = factory();
	} else {
		var a = factory();
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
}(this, function () {

//================================================================================

var s_debug = false;

//================================================================================

/**
 * Конструктор для створення об'єкту для взаємодії з iframe SignWidget
 * @param parentId - Ідентифікатор батківського елементу для відображення iframe, 
 * який завантажує сторінку SignWidget
 * @param id - Ідентифікатор iframe, який завантажує сторінку SignWidget
 * @param src - URI з адресою за якою розташована сторінка SignWidget
 * @param formType - Тип форми для відображення (див. константи EndUser.FormType)
 * @param formParams - Параметри форми для відображення (див. EndUser.FormParams)
 */
var EndUser = function(parentId, id, src, formType, formParams) {
	this.sender = "EndUserSignWidgetConnector";
	this.reciever = "EndUserSignWidget";
	this.version = "20240701";
	this.parentId = parentId;
	this.id = id;
	this.src = src;
	this.formType = formType || 0;
	this.formParams = formParams || null;
	this.iframe = this._appendIframe(parentId, id, src);
	this.m_isIframeLoad = false;
	this.m_promises = [];
	this.m_listeners = [];
};

//--------------------------------------------------------------------------------

/**
 * Деструктор для видалення об'єкту для взаємодії з iframe SignWidget
 */
EndUser.prototype.destroy = function() {
	this._removeIframe(this.iframe, this.parentId);
	this.m_promises = [];
};

//================================================================================

EndUser.prototype._parseURL = function(url) {
	var urlRegEx = new RegExp([
					'^(https?:)//',
					'(([^:/?#]*)(?::([0-9]+))?)',
					'(/{0,1}[^?]*)'
				].join(''));
	var match = url.match(urlRegEx);
	return match && {
		protocol: match[1],
		host: match[2],
		hostname: match[3],
		port: match[4],
		pathname: match[5],
		origin: match[1] + '//' + match[2]
	};
};

//--------------------------------------------------------------------------------

EndUser.prototype._appendIframe = function(parentId, id, src) {
	var pThis = this;

	var srcParams = '?address=' + 
		pThis._parseURL(window.location.href).origin;
	srcParams += '&formType=' + pThis.formType;
	srcParams += '&debug=' + false;
	if (pThis.formParams) {
		for (var paramName in pThis.formParams)
			srcParams += '&' + paramName + '=' + pThis.formParams[paramName];
	}

	var iframe = document.createElement("iframe");
	iframe.setAttribute("src", src + srcParams);
	iframe.setAttribute("id", id);
	iframe.setAttribute("frameborder", "0");
	iframe.setAttribute("allowtransparency", "true");
	iframe.setAttribute("width", "100%");
	iframe.setAttribute("height", "100%");
	document.getElementById(parentId).appendChild(iframe);

	var origin = pThis._parseURL(src).origin;
	iframe.listener = function(event) {
		if (event.origin !== origin)
			return;

		pThis._recieveMessage(event);
	};
	iframe.addEventListener("load", (event) => {
		pThis.m_isIframeLoad = true;
		if (s_debug)
			console.log("iframe loaded");

		var promises = pThis.m_promises;
		pThis.m_promises = [];

		promises.forEach(function(promise) {
			pThis._postMessage(
				promise.msg.cmd, promise.msg.params, 
				promise.resolve, promise.reject);
		});
	});
	window.addEventListener("message", iframe.listener, false);

	return iframe;
};

//--------------------------------------------------------------------------------

EndUser.prototype._removeIframe = function(iframe, parentId) {
	if (iframe == null)
		return;

	if (iframe.listener != null) {
		window.removeEventListener("message", iframe.listener);
		iframe.listener = null;
	}

	document.getElementById(parentId).removeChild(iframe);
};

//--------------------------------------------------------------------------------

EndUser.prototype._postMessage = function(cmd, params, _resolve, _reject) {
	var pThis = this;

	var p = null;
	var msg = {
		sender: pThis.sender,
		reciever: pThis.reciever,
		id: -1,
		cmd: cmd,
		params: params
	};

	if (typeof _resolve == 'undefined' && typeof _reject == 'undefined') {
		p = new Promise(function(resolve, reject) {
			msg.id = pThis.m_promises.push({
				resolve: resolve,
				reject: reject,
				msg: msg
			});
		});
	} else {
		msg.id = pThis.m_promises.push({
			resolve: _resolve,
			reject: _reject,
			msg: msg
		});
	}

	if (pThis.m_isIframeLoad) {
		try {
			var signWidget = document.getElementById(pThis.id);
			signWidget.contentWindow.postMessage(msg, pThis.src);
			if (s_debug)
				console.log("Main page post message: " + msg);
		} catch (e) {
			if (s_debug)
				console.log("Main page post message:" + msg + ", error: " + e);
		}
	}

	return p;
};

//--------------------------------------------------------------------------------

EndUser.prototype._recieveMessage = function(event) {
	var pThis = this;

	if (s_debug)
		console.log("Main page recieve message: " + event.data);

	var data = event.data;
	if ((data.reciever != pThis.sender) ||
		(data.sender != pThis.reciever)) {
		return;
	}

	if (data.id == -1) {
		var promises = pThis.m_promises;
		pThis.m_promises = [];

		promises.forEach(function(promise) {
			pThis._postMessage(
				promise.msg.cmd, promise.msg.params, 
				promise.resolve, promise.reject);
		});

		return;
	} else if (data.id == -2) {
		var widgetEvent = data.result;
		if (pThis.m_listeners[widgetEvent.type])
			pThis.m_listeners[widgetEvent.type](widgetEvent);
		return;
	}

	var p = pThis.m_promises[data.id - 1];
	if (!p) {
		return;
	}

	delete pThis.m_promises[data.id - 1];

	if (data.error) {
		p.reject(data.error);
	} else {
		p.resolve(data.result);
	}
};

//================================================================================

/**
 * Константи та функції підтримка яких буде видалена в наступних версіях
*/

/**
 * Типи форм для відображення в SignWidget. Змінено на EndUser.FormType.
*/
EndUser.FORM_TYPE_READ_PKEY = 1;
EndUser.FORM_TYPE_MAKE_NEW_CERTIFICATE = 2;
EndUser.FORM_TYPE_SIGN_FILE = 3;

//================================================================================

/**
 * Типи форм для відображення в SignWidget (Для самодостатніх форм взаємодії 
 * між web-сайтом та iframe не передбачена):
 * - ReadPKey				- Зчитування ос. ключа. Форма призначена для  
 * криптографічних операцій, які потребують ос. ключ користувача, наприклад 
 * виконання накладання підпису, шифрування\розшифрування даних.
 * - MakeNewCertificate		- Формування нового сертифікату. Форма призначена для
 * формування нового сертифікату з використанням діючого ос. ключа користувача.
 * - SignFile				- Накладання підпису на файл. Форма призначена для 
 * накладання підпису на файли та містить необхідні елементи з вибору файлів,
 * алгоритму та типу підпису. Самодостатня форма.
 * - ViewPKeyCertificates	- Відображення інформації про сертифікати ос. ключа. 
 * Форма призначена для відображення інформації про сертифікати зчитаного
* - MakeDeviceCertificate - Формування сертифікату для пристрою. Форма  
 * призначена для формування технологічного сертифікату для пристрою з 
 * використанням ос. ключа, відповідальної особи.
 * ос. ключа. Самодостатня форма.
*/
EndUser.FormType = {
	"ReadPKey":					1,
	"MakeNewCertificate":		2,
	"SignFile":					3,
	"ViewPKeyCertificates":	 	4,
	"MakeDeviceCertificate":	5
};

//--------------------------------------------------------------------------------

/**
 * Додаткові параметри форми відображення віджету:
 * - ownCAOnly		- зчитувати ос. ключі тільки свого ЦСК (першого в CAs.json).
 * Діалог вибору ЦСК не відображається
 * - showPKInfo		- відображати інформацію про зчитаний ос. ключ
 * - showSignTip	- відображати крок з інформацією про рекомендуємий тип підпису 
 * - language		- мова інтерфейсу віджету (підтримується українська - ua, 
 * англійська - en)
*/
EndUser.FormParams = function() {
	this.ownCAOnly = false;
	this.showPKInfo = true;
	this.showSignTip = true;
	this.language = 'ua';
};

//--------------------------------------------------------------------------------

/**
 * Додатковий тип даних для передачі імені для даних:
 * - name						- ім'я даних (наприклад файла).
 * - val <Uint8Array | string>	- дані
*/
EndUser.NamedData = function(name, val) {
	this.name = name;
	this.val = val;
};

//--------------------------------------------------------------------------------

/**
 * Типи сповіщеннь віджету підпису:
 * - ConfirmKSPOperation	- Сповіщення про необхідність підтвердження операції
 * з використання ос. ключа за допомогою сканування QR-коду в мобільному додатку
 * сервісу підпису. Повертається об'єкт EndUser.ConfirmKSPOperationEvent 
*/
EndUser.EventType = {
	"ConfirmKSPOperation":	2
};

//--------------------------------------------------------------------------------

/**
 * Типи алгоритмів підпису:
 * - DSTU4145WithGOST34311	- ДСТУ-4145 з використанням алгоритму гешування ГОСТ34310
 * - RSAWithSHA				- RSA з використанням алгоритму гешування SHA256
 * - ECDSAWithSHA			- ECDSA з використанням алгоритму гешування SHA256
 * - DSTU4145WithDSTU7564	- ДСТУ-4145 з використанням алгоритму гешування ДСТУ7564
*/
EndUser.SignAlgo = {
	"DSTU4145WithGOST34311":	1,
	"RSAWithSHA":				2,
	"ECDSAWithSHA":				3,
	"DSTU4145WithDSTU7564":		4
};

//--------------------------------------------------------------------------------

/**
 * Формат підпису CAdES:
 * - CAdES_BES		- базовий формат підпису. Включає позначку часу 
 * від даних та сертифікат підписувача
 * - CAdES_T		- підис CAdES_BES, який додатково включає позначку 
 * часу від ЕЦП
 * - CAdES_C		- підпис CAdES-T, який додатково включає посилання 
 * на повний набір сертифікатів для перевірки підпису
 * - CAdES_X_Long	- підпис CAdES-C, який додатково включає повний набір 
 * сертифікатів ЦСК для перевірки підпису, а також відповідь від OCSP сервера 
 * зі статусом сертифіката підписувача
 *  - CAdES_X_Long_Trusted - підпис CAdES-X_Long, який додатково включає
 * відповідь від OCSP сервера зі статусом сертифіката TSP-сервера
*/
EndUser.SignType = {
	"CAdES_BES":			1,
	"CAdES_T":				4,
	"CAdES_C":				8,
	"CAdES_X_Long":			16,
	"CAdES_X_Long_Trusted":	144
};

//--------------------------------------------------------------------------------

/**
 * Формат підпису PAdES:
 * - PAdES_B_B		- базовий формат підпису. Включає позначку часу 
 * від даних та сертифікат підписувача
 * - PAdES_B_T		- підис PAdES_B_B, який додатково включає позначку 
 * часу від ЕЦП
*/
EndUser.PAdESSignLevel = {
	"PAdES_B_B":			1,
	"PAdES_B_T":			4
};

//--------------------------------------------------------------------------------

/**
 * Формат підпису XAdES:
 * - Detached		- зовнішній (дані та файл зберігаються окремо)
 * - Enveloped		- внутрішній (дані та файл зберігаються в одному файлі).
 * Може використовуватися тільки для підпису xml-документів 
 * часу від ЕЦП
*/
EndUser.XAdESType = {
	"Detached":			1,
	"Enveloped":		3
};

//--------------------------------------------------------------------------------

/**
 * Формат підпису XAdES:
 * - XAdES_B_B		- базовий формат підпису
 * - XAdES_B_T		- підис XAdES_B_B, який додатково включає позначку 
 * часу від ЕЦП
 * - XAdES_B_LT		- підис XAdES_B_T, який додатково включає набір 
 * сертифікатів ЦСК для перевірки підпису для довгострокового зберігання
 * - XAdES_B_LTA	- підис XAdES_B_LT, який додатково включає 
 * архівну позначку часу
*/
EndUser.XAdESSignLevel = {
	"XAdES_B_B":			1,
	"XAdES_B_T":			4,
	"XAdES_B_LT":			16,
	"XAdES_B_LTA":			32
};

//--------------------------------------------------------------------------------

/**
 * Формат контейнеру ASiC:
 * - S		- ASiC-S (простий)
 * - E		- ASiC-E (розширений)
*/
EndUser.ASiCType = {
	"S":			1,
	"E":			2
};

//--------------------------------------------------------------------------------

/**
 * Тип підпису ASiC:
 * - CAdES
 * - XAdES
*/
EndUser.ASiCSignType = {
	"CAdES":			1,
	"XAdES":			2
};

//--------------------------------------------------------------------------------

/**
 * Призначення ключа (бітова маска):
 * - DigitalSignature	- ключ призначений для накладання ЕЦП
 * - KeyAgreement		- ключ призначений для протоколів розподілу
 *  ключів (направленого шифрування)
 * Призначення ключа міститься в інформації про сертифікат
 */
EndUser.KeyUsage = {
	"DigitalSignature":	1,
	"KeyAgreement":		16,
};

/**
 * Тип відкритого ключа (алгоритму):
 * - DSTU4145			- ключ призначений для використання в алгоритмах ДСТУ 4145
 * - RSA				- ключ призначений для використання в алгоритмах RSA
 * - ECDSA				- ключ призначений для використання в алгоритмах ECDSA
 * Тип відкритого ключа міститься в інформації про сертифікат
 */
EndUser.PublicKeyType = {
	"DSTU4145":			1,
	"RSA":				2,
	"ECDSA":			4,
};

/**
 * Тип алгоритму гешування сертифіката:
 * - GOST34311			- алгоритму гешування ГОСТ34310
 * - SHA1				- алгоритму гешування SHA-1
 * - SHA224				- алгоритму гешування SHA-224
 * - SHA256				- алгоритму гешування SHA-256
 * - SHA384				- алгоритму гешування SHA-384
 * - SHA512				- алгоритму гешування SHA-512
 * - DSTU7564_256		- алгоритму гешування ДСТУ-7564-256
 * - DSTU7564_384		- алгоритму гешування ДСТУ-7564-384
 * - DSTU7564_512		- алгоритму гешування ДСТУ-7564-512
 * Тип алгоритму гешування сертифіката міститься в інформації про сертифікат
 */
EndUser.CertHashType = {
	"GOST34311":		1,
	"SHA1":				2,
	"SHA224":			3,
	"SHA256":			4,
	"SHA384":			5,
	"SHA512":			6,
	"DSTU7564_256":		7,
	"DSTU7564_384":		8,
	"DSTU7564_512":		9
};

//--------------------------------------------------------------------------------

/**
 * Тип запиту для зміни статусу власного сертифіката користувача:
 * - Revoke				- відкликання
 * - Hold				- блокування
 */
EndUser.CCSType = {
	"Revoke": 			1,
	"Hold":				2
};

/**
 * Причина відкликання власного сертифіката користувача:
 * - Unknown			- невизначена
 * - KeyCompromise		- компрометація ос. ключа
 * - NewIssued			- формування нового ос. ключа
 */
EndUser.RevocationReason = {
    "Unknown":			0,
    "KeyCompromise":	1,
    "NewIssued":		2
};

//================================================================================

/**
 * Сповіщення про необхідність підтвердження операції з використання ос. ключа 
 * за допомогою сканування QR-коду в мобільному додатку сервісу підпису 
 * @property url <string> - URL для підтвердження операції
 * @property qrImage <string> - Зображення у вигляді QR-коду в форматі BMP, 
 * закодоване з використанням кодування BASE64 
 * @property mobileAppName <string> - Ім'я мобільного додатку сервісу підпису 
*/
EndUser.ConfirmKSPOperationEvent = function() {
	this.url = '';
	this.qrImage = '';
	this.mobileAppName = '';
};

//================================================================================

/**
 * Реєстрація обробника для отримання сповіщення про події від віджету підпису.
 * @param eventType <EndUser.EventType> - Тип події
 * @param listener <function (event <EndUser.Event>)> - Функція-обробник подій
 * @returns Promise<Array<void>> 
*/
EndUser.prototype.AddEventListener = function(eventType, listener) {
	this.m_listeners[eventType] = listener;

	var params = [eventType];
	return this._postMessage('AddEventListener', params);
};

//================================================================================

/**
 * Стирання зчитаного ос. ключа користувача.
 * @returns Promise<Array<void>> 
*/
EndUser.prototype.ResetPrivateKey = function() {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('ResetPrivateKey', params);
};

//--------------------------------------------------------------------------------

/**
 * Зчитування ос. ключа користувача. Функція повинна викликатися до 
 * функцій які використовують ос. ключ, наприклад SignHash, SignData.
 * Проміс буде виконано, коли користувач зчитає ос. ключ. Якщо ос. ключ 
 * вже зчитано проміс виконується відразу.  
 * @returns Promise<Array<object>> - Масив з інформацією про сертифікати 
 * зчитаного ос. ключа
*/
EndUser.prototype.ReadPrivateKey = function() {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('ReadPrivateKey', params);
};

//--------------------------------------------------------------------------------

/**
 * Формування нового сертифікату для діючого ключа. Діючий ключ попередньо 
 * повинен бути зчитаний функцією ReadPrivateKey, після чого необхідно викликати 
 * функцію MakeNewCertificate для відображена форми обрання носія нового ключа
 * @param euParams <object> - Інформація про користувача, яку необхідно змінити 
 * в новому сертифікаті. Доступні поля phone, EMail. Опціональний параметр
 * @returns Promise<void>
*/
EndUser.prototype.MakeNewCertificate = function(euParams) {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('MakeNewCertificate', params);
};

//--------------------------------------------------------------------------------

/**
 * Формування сертифікатів для пристрою з використанням ос. ключа 
 * відповідальної особи. Ос. ключ відповідальної особи попередньо повинен 
 * бути зчитаний функцією ReadPrivateKey, після чого необхідно викликати 
 * функцію MakeDeviceCertificate для відображена форми формування сертифікатів
 * @param certParams <object> - Параметри сертифікату
 * @returns Promise<void>
*/
EndUser.prototype.MakeDeviceCertificate = function(certParams) {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('MakeDeviceCertificate', params);
};

//--------------------------------------------------------------------------------

/**
 * Зміна статусу сертифікату діючого ос. ключа користувача. Діючий ключ попередньо 
 * повинен бути зчитаний функцією ReadPrivateKey, після чого необхідно викликати 
 * функцію ChangeOwnCertificatesStatus
 * @param ccsType <CCSType> - Тип запиту для зміни статусу власного 
 * сертифіката користувача
 * @param revocationReason <RevocationReason> - Причина відкликання власного 
 * сертифіката користувача. При блокуванні сертифікату передається значення
 * EndUser.RevocationReason.Unknown.
 * @returns Promise<void>
*/
EndUser.prototype.ChangeOwnCertificatesStatus = function(
	ccsType, revocationReason) {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('ChangeOwnCertificatesStatus', params);
};

//--------------------------------------------------------------------------------

/**
 * Підпис геш значення(ь) в форматі CAdES. Зчитаний ос. ключ повинен мати 
 * сертифікат призначений для підпису та тип відкритого ключа повинен відповідати 
 * алгоритму підпису.
 * @param hash <Uint8Array | string | NamedData | Array <Uint8Array | string |
 * NamedData>> - геш значення для підпису у вигляді масиву байт, закодоване
 * у вигляді строки BASE64, у вигляді об'єкту NamedData або масив з об'єктів 
 * одного з перелічених типів
 * @param asBase64String <boolean> - Признак необхідності повертати 
 * підпис у вигляді строки BASE64. Опціональний параметр. За замовчанням - false.
 * @param signAlgo <number> - Алгоритм підпису. Можливі значення визначені в 
 * EndUser.SignAlgo. За замовчанням - EndUser.SignAlgo.DSTU4145WithGOST34311.
 * @param signType <number> - Тип підпису. Можливі значення визначені в 
 * EndUser.SignType. За замовчанням - EndUser.SignType.CAdES_BES.
 * @param previousSign <Uint8Array | string | Array <Uint8Array | string>> - 
 * попередній підпис(и) для геш значення(ь), до якого(их) буде додано
 * створений підпис. Додавання підпису можливе лише за умови
 * якщо алгоритми підписів (signAlgo) співпадають, та попередній підпис 
 * не містить підписувача. Опціональний параметр. За замовчанням - null. 
 * @returns Promise<Uint8Array | string | NamedData | Array <Uint8Array | 
 * string | NamedData>> - Підпис(и)
*/
EndUser.prototype.SignHash = function(
	hash, asBase64String, signAlgo, signType, previousSign) {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('SignHash', params);
};

//--------------------------------------------------------------------------------

/**
 * Підпис даних в форматі CAdES. Зчитаний ос. ключ повинен мати сертифікат 
 * призначений для підпису та тип відкритого ключа повинен відповідати алгоритму
 * підпису.
 * @param data <Uint8Array | string | NamedData | Array <Uint8Array | string | 
 * NamedData>> - дані для підпису. Дані, що передаються у вигляді string  
 * автоматично конвертуються до типу Uint8Array з використанням кодування UTF-8
 * @param external <boolean> - Признак необхідності формування зовнішнього 
 * підпису (дані та підпис зберігаються окремо). Опціональний параметр. 
 * За замовчанням - true.
 * @param asBase64String <boolean> - Признак необхідності повертати 
 * підпис у вигляді строки BASE64. Опціональний параметр. За замовчанням - false.
 * @param signAlgo <number> - Алгоритм підпису. Можливі значення визначені в 
 * EndUser.SignAlgo. За замовчанням - EndUser.SignAlgo.DSTU4145WithGOST34311.
 * @param previousSign <Uint8Array | string | Array <Uint8Array | string>> - 
 * попередній підпис(и) для даних, до якого(их) буде додано створений підпис. 
 * Додавання підпису можливе лише за умови якщо алгоритми підписів (signAlgo) 
 * співпадають, та попередній підпис не містить підписувача. Опціональний параметр. 
 * За замовчанням - null. Для внутрішнього підпису (external = false) параметр 
 * data не використовується.
 * @param signType <number> - Тип підпису. Можливі значення визначені в 
 * EndUser.SignType. За замовчанням - EndUser.SignType.CAdES_BES.
 * @returns Promise<Uint8Array | string | NamedData | Array <Uint8Array | 
 * string | NamedData>> - Підпис(и)
*/
EndUser.prototype.SignData = function(
	data, external, asBase64String, signAlgo, previousSign, signType) {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('SignData', params);
};

//--------------------------------------------------------------------------------

/**
 * Підпис PDF-файлу в форматі PAdES. Зчитаний ос. ключ повинен мати 
 * сертифікат призначений для підпису та тип відкритого ключа повинен відповідати 
 * алгоритму підпису.
 * @param data <Uint8Array | NamedData | Array <Uint8Array | NamedData>> - pdf-документ 
 * для підпису у вигляді масиву байт чи у вигляді об'єкту NamedData.
 * @param asBase64String <boolean> - Признак необхідності повертати 
 * підпис у вигляді строки BASE64. Опціональний параметр. За замовчанням - false.
 * @param signAlgo <number> - Алгоритм підпису. Можливі значення визначені в 
 * EndUser.SignAlgo. За замовчанням - EndUser.SignAlgo.DSTU4145WithGOST34311.
 * @param signLevel <number> - Тип підпису. Можливі значення визначені в 
 * EndUser.PAdESSignLevel. За замовчанням - EndUser.PAdESSignLevel.PAdES_B_B.
 * @returns Promise<Uint8Array | NamedData | string | Array <Uint8Array | NamedData | string>> - Підпис(и)
*/
EndUser.prototype.PAdESSignData = function(
	data, asBase64String, signAlgo, signLevel) {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('PAdESSignData', params);
};

//--------------------------------------------------------------------------------

/**
 * Підпис даних в форматі XAdES. Зчитаний ос. ключ повинен мати 
 * сертифікат призначений для підпису та тип відкритого ключа повинен відповідати 
 * алгоритму підпису.
 * @param xadesType <number> - Тип підпису. Можливі значення визначені в 
 * EndUser.XAdESType.
 * @param references <Array <NamedData>> - масив даних у вигляді об'єкту NamedData 
 * для підпису
 * @param asBase64String <boolean> - Признак необхідності повертати 
 * підпис у вигляді строки BASE64. Опціональний параметр. За замовчанням - false.
 * @param signAlgo <number> - Алгоритм підпису. Можливі значення визначені в 
 * EndUser.SignAlgo. За замовчанням - EndUser.SignAlgo.DSTU4145WithGOST34311.
 * @param signLevel <number> - Тип підпису. Можливі значення визначені в 
 * EndUser.XAdESSignLevel. За замовчанням - EndUser.XAdESSignLevel.XAdES_B_B.
 * @returns Promise<NamedData> - Підпис
*/
EndUser.prototype.XAdESSignData = function(
	xadesType, references, asBase64String, signAlgo, signLevel) {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('XAdESSignData', params);
};

//--------------------------------------------------------------------------------

/**
 * Підпис даних в форматі ASiC. Зчитаний ос. ключ повинен мати 
 * сертифікат призначений для підпису та тип відкритого ключа повинен відповідати 
 * алгоритму підпису.
 * @param asicType <number> - Формат контейнеру. Можливі значення визначені в 
 * EndUser.ASiCType
 * @param signType <number> - Тип підпису. Можливі значення визначені в 
 * EndUser.ASiCSignType
 * @param references <Array <NamedData>> - масив даних у вигляді об'єкту NamedData 
 * для підпису
 * @param asBase64String <boolean> - Признак необхідності повертати 
 * підпис у вигляді строки BASE64. Опціональний параметр. За замовчанням - false.
 * @param signAlgo <number> - Алгоритм підпису. Можливі значення визначені в 
 * EndUser.SignAlgo. За замовчанням - EndUser.SignAlgo.DSTU4145WithGOST34311.
 * @param signLevel <number> - Тип підпису. Можливі значення визначені в 
 * EndUser.SignType для CAdES або EndUser.XAdESSignLevel для XAdES. 
 * За замовчанням - EndUser.SignType.CAdES_BES для CAdES або 
 * EndUser.XAdESSignLevel.XAdES_B_B для XAdES
 * @returns Promise<NamedData> - Підпис
*/
EndUser.prototype.ASiCSignData = function(
	asicType, signType, references, asBase64String, signAlgo, signLevel) {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('ASiCSignData', params);
};

//--------------------------------------------------------------------------------

/**
 * Зашифрування даних з використанням алгоритму ГОСТ 28147-2009 та 
 * протоколу розподілу ключів ДСТУ 4145-2002. Зчитаний ос. ключ повинен мати
 * сертифікат, який призначений для протоколів розподілу ключів в державних 
 * алгоритмах та протоколах.
 * @param recipientsCerts <Array<Uint8Array>> - сертифікати отримувачів.
 * Сертифікати отримувачів повинні мати призначеня для протоколів розподілу 
 * ключів в державних алогритмах та протоколах.
 * @param data <Uint8Array | string> - дані для зашифрування. Дані, що 
 * передаються у вигляді string автоматично конвертуються до типу Uint8Array 
 * з використанням кодування UTF-8
 * @param signData <boolean> - Признак необхідності додатково підписувати дані 
 * (зашифровані дані спеціального формату з підписом, який автоматично 
 * перевіряється при розшифруванні даних). Зчитаний ос. ключ повинен мати 
 * сертифікат, який призначений для підпису даних за алгоритмом ДСТУ 4145. 
 * Опціональний параметр. За замовчанням - false.
 * @param asBase64String <boolean> - Признак необхідності повертати 
 * зашифровані дані у вигляді строки BASE64. Опціональний параметр. 
 * За замовчанням - false.
 * @param useDynamicKey <boolean> - Признак необхідності зашифровувати дані з 
 * використанням динамічного ключа відправника. Призначений для використання у 
 * разі відсутності сертифікат відправника, який призначений для протоколів 
 * розподілу ключів в державних алгоритмах та протоколах. Опціональний параметр. 
 * За замовчанням - false.
 * @returns Promise<Uint8Array | string> - Зашифровані дані
*/
EndUser.prototype.EnvelopData = function(
	recipientsCerts, data, signData, asBase64String, useDynamicKey) {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('EnvelopData', params);
};

//--------------------------------------------------------------------------------

/**
 * Розшифрування даних з використанням алгоритму ГОСТ 28147-2009 та 
 * протоколу розподілу ключів ДСТУ 4145-2002. Зчитаний ос. ключ повинен мати
 * сертифікат, який призначений для протоколів розподілу ключів в державних 
 * алгоритмах та протоколах.
 * @param envelopedData <Uint8Array | string> - дані для розшифрування. Дані, що 
 * передаються у вигляді string повинні бути закодовані з використанням кодування
 * BASE64
 * @param senderCert <Uint8Array> - Сертифікат відправника зашифрованих даних.
 * Опціональний параметр. За замовчанням - null.
 * @returns Promise<any> - Інформація про відправника та розшифровані дані
*/
EndUser.prototype.DevelopData = function(
	envelopedData, senderCert) {
	var params = Array.prototype.slice.call(arguments);
	return this._postMessage('DevelopData', params);
};

//================================================================================

	return {
		EndUser : EndUser
	};
}));

//================================================================================
