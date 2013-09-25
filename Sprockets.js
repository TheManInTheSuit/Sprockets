var Sprockets = {
	Environment: window || this,
	Directory: "",
	Filename: "Sprockets.compiled.js",
	Version: "v1.0.0",
	clone: function (obj) {
		var Clone;
		var type = typeof obj;
		if(type == "function" || type == "object") {
			function Clone () { }
			Clone.prototype = obj;
		}
		else {
			return obj;
		}
		
		var result = new Clone();
		
		for (var property in Clone) {
			var prop = obj[property];
			var clone = Sprockets.clone(prop);
			result[property] = clone;
		}

		return result;
	},
	implement: function (sender, argument) {
		for (var property in argument) {
			if (sender.hasOwnProperty(property)) {			
				var childProperty = argument[property];
				var senderProperty = sender[property];
				if (typeof childProperty == "function") {
					Sprockets.define(sender).getter(property, function (/*arguments*/) {
						var args = Array.prototype.slice.call(arguments);
						childProperty.base = function () {
							return senderProperty.apply(senderProperty, args);
						}
						childProperty.apply(childProperty, args);
					});
				}
			}
			else {
				sender[property] = argument[property];
			}
		}
	},
	pool: function (prototype) {
		var objects = []
		var self = this;
		
		var value = function (/*arguments*/) {
			var result = this;
			if (objects.length == 0) {
				prototype.constructor.call(result, arguments);
			}
			else {
				result = objects.pop();
				this.call(result, arguments);
			}
			return result;
		}
				
		self.init = function (count) {
			for (var i = 0, length = count; i < count; i++) {
				self.value();
			}
		}
		
		self.get = function (/*arguments*/) {
			var _self = this;
			var result = value(arguments);
			var disposable = new Sprockets.Disposable(function () {
				objects.push(result);
			});
			
			disposable.__defineGetter__("value", function () {
				if(disposable.isDisposed) result = value(_self.arguments);
			});
			return disposable;
		}
	},
	memento: function (object) {
		var copy = Sprockets.Objects.clone(object);
		this.restore = function () {
			for (var property in object) {
				if (copy.hasOwnProperty(property)) {
					object[property] = copy[property];
				} 
				else {
					delete object[property];
				}
			}
		}
	},
	empty: function (value) {
		return value === undefined && value !== 0;
	},
	equals: function(sender, other) {
		if(Sprockets.empty(sender) || Sprockets.empty(other)) {
			return sender === other;
		}
		else {
			var result = true;
			if(typeof sender != "object" && typeof other != "object") {
				result = sender == other;
			}
			for(var member in sender) {
				var property = sender[member];
				
				if(other.hasOwnProperty(member)) {
					var otherProperty = other[member];
					if(typeof property == "object") {
						result = result && Sprockets.equals(property, otherProperty)
					}
					else {
						result = result && (property == otherProperty);
					}
				}
				else return false;
			}
			return result;
		}
		
	},
	define: function (handle) {
		var self = this;
		this.getter = function (name, data, member) {
			handle.__defineGetter__(name, function () { 
				if(member) return data[member]; 
				else return data;
			});
			return self;
		}
		this.setter = function(name, data, member) {
			handle.__defineSetter__(name, function (value) {
				if(member) data[member] = value;
				else data[name] = value;
			});
			return self;
		}
		return this;
	}
};
Sprockets.Object = function () {
	
}
Sprockets.Disposable = function (unsubscriber, handle) {
	var data = { IsDisposed: false }
	
	Sprockets.define(this)
		.getter("disposed", data, "IsDisposed")
		.getter("dispose", function () {
			unsubscriber(handle);
			data.IsDisposed = true;
		});
}
Sprockets.Function = function (delegate, options) {
	options = options || { };
	var asyncResult = {
		completed: false,
		options: options,
		state: null
	}
	var logic = function (/*arguments*/) {
		var result, args = Array.prototype.slice.call(arguments);

		try {
			result = delegate.apply(delegate, args);
			if(options.done) options.done(result);
		}
		catch (error) {
			if (options.fail) options.fail(error);
		}
		finally {
			if (options.always) options.always();
		}
		if (options.then) options.then();

		return result;
	}
	Sprockets.define(logic)
		.getter("options", asyncResult, "options")
		.getter("completed", asyncResult, "completed")
		.getter("state", asyncResult, "state")
		.getter("delay", function(interval) {
			return function (/*arguments*/) {
				var args = Array.prototype.slice.call(arguments);		
				var handle = setTimeout(function () {
					asyncResult.state = logic.apply(null, args);
					asyncResult.completed = true;
				}, interval);
				
				return new Sprockets.Disposable(function () {
					clearTimeout(handle);
					asyncResult.completed = true;
				});
			}
		});
	return logic;
}
Sprockets.Function.prototype = function () {
	var self = new Sprockets.Object();
	
	self.partial = function () {
		var fn = this, args = Array.prototype.slice.call(arguments, 1);
		return function () {
			var arg = 0;
			for ( var i = 0, length = args.length; i < length && arg < length; i++ ) {
				if (args[i] === undefined) {
					args[i] = arguments[arg++];
				}
			}
			return fn.apply(this, args);
		};
	}
	self.curry = function () {
		return function (x) {
			return function (y) {
				return self(x, y);
			}
		}
	}
	self.uncurry = function () {
		return function (x) {
			return function (y) {
				return self(x)(y);
			}
		}
	}
	//for(n)(args)
	self.for = function (n) {
		return function () {
			for(var i = 0; i < n; i++) {
				self.apply(self, arguments);
			}
		}
	}
	//each(items)(args)
	self.each = function (items) {
		return function () {
			for(var i = 0, length = items.length; i < length; i++) {
				self.apply(self, arguments);
			}
		}
	}
	//while(predicate)(args)
	self.while = function (predicate) {
		return function () {
			while (predicate()) {
				self.apply(self, arguments);
			}
		}
	}
	self.when = function(predicate) {
		return function () {
			if(predicate()) self.apply(self, arguments);
			return self;
		}
	}
	self.fluently = function(delegate) {
		return function() {
			delegate.apply(self, arguments);
			return self;
		}
	}
	self.maybe = function (delegate) {
		return function () {			
			if(arguments.length !== 0) {
				var each = Sprockets.Collections.each;
				for(var i = 0, length = arguments.length; i < length; ++i) {
					var value = arguments[i];
					if(Sprockets.empty(value)) {
						return value;
					}
				}
				return delegate.apply(this, arguments);
			}
		}
	}
}();

Sprockets.Combinators = function () {
	//Sxyz = xz(yz)
	var S = this.S = this.starling = function (x) {
		return function (y) {
			return function (z) {
				return x(z)(y(z));
			}
		}
	}
	//Kxy = x
	var K = this.K = this.kestrel = this.true = function (x) {
		return function(y) {
			return x;
		}
	}
	//Ix = x
	var I = this.I = this.identity = this.idiot = function (x) {
		return x;
	}
	//ix = xSK
	//i = S(SI(KS))(KK)
	var iota = this.iota = S( S(I) (K(S))) (K(K));
	//Bxyz = x(yz)
	//S (K S) K
	var B = this.B = this.bluebird = function (x) {
		return function(y) {
			return function(z) {
				return x(y(z));
			}
		}
	}
	
	//BB = S(K((S(K(S))(K))));
	var D = this.D = this.dove = B(B);
	//BBB
	var B1 = this.B1 = this.blackbird = B(B(B));
	
	//B(BBB) = B(B1) = B3
	var E = this.E = this.eagle = B(B1);
	
	//B(BBB)B = B(B1)B
	var B2 = this.B2 = this.bunting = E(B);

	//B(BB) = B(D)
	var D1 = this.D1 = this.dickcissel = B(D);
	//B(BB)B = B(D)B = D1B
	var B3 =this.B3 = this.becard = D1(B);
	
	//Cxyz = xyz
	//S(BBS)(KK)
	//S (S (K ( S (K S) K)) S) (K K)
	var C = this.C = this.cardinal = function (x) {
		return function (y) {
			return function (z) {
				return x(y)(z);
			}
		}
	}

	//BB(BB) = D(D)
	var D2 = this.D2 = this.dovekies = D(D);

	//B(BBB)(B(BBB)) = B(D1)(B(D1)) = E(E)
	var E1 = this.E1 = this.baldeagle = E(E);
	
	//CI
	var T = this.T = this.thrush = C(I);
	//ETTET
	var F = this.F = this.finch = E(T(T(E(T))));
	//BBC
	var G = this.G = this.goldfinch = B(B(C));
	//BW(BC)
	var H = this.H = this.hummingbird = B(W)(B(C));
	
	//BC
	var C_ = this.C_ = this.cardinal_ = B(C);
	//C_C_
	var R_ = this.R_ = this.robin_ = C_(C_);
	//BBT
	var R = this.R = this.robin = B(B(T));
	
	//SII
	var M = this.M = this.mockingbird = function (x) {
		return x(x);
	};
	
	//C(BMR)
	var W = this.W = this.warbler = C(B(M(R)));
	//B(BC)(W(BC(B(BBB)))) = B(BC)(W(BC(E)))
	var J = this.J = this.jay = B(B(C))(W(B(C)(E)));
	//Wxy = xyy
	//CBM
	//S S (S K)
	var L = this.L = this.lark = C(B(M));
	/*function(x) {
		return function (y) {
			//return x(y(y));
			//return x(B(y));
			//return B(x)(M);
		}
	}*/

	//BM
	var M2 = this.M2 = this.doublemockingbird = B(M);
	var M3 = this.M3 = this.meadowlark = function (x) {
		return function (y) {
			return M(x)(y);
		}
	}
	//SI
	var O = this.O = this.owl = S(I);
	//CB
	var Q = this.Q = this.queerbird = C(B);
	//BCB = B(Q)
	var Q1 = this.Q1 = this.quixoticbird = B(Q);
	//C(BCB) = C(Q1)
	var Q2 = this.Q2 = this.quizzicalbird = Q1(C);
	//BT
	var Q3 = this.Q3 = this.quirkybird = B(T);
	

	//BC_R_
	var F_ = this.F_ = this.finch_ = B(C_(R_));
	//F_B
	var Q4 = this.Q4 = this.quackybird = F_(B);


	//LO
	var U = this.U = this.turing = L(O);
	//BCT
	var V = this.V = this.vireo = this.pairing = B(C(T));

	//CW
	var W1 = this.W1 = this.conversewarbler = C(W);
	//SLL
	//Y = S (K (S I I)) (S (S (K S) K) (K (S I I)))
	var Y = this.Y = this.whybird = this.sage = function(f) {
		function g(x) {
			return function (y) {
				return f(M(x))(y);
			}
		};
		return g(g);
	}
	var Z = this.Z = function (x) {
		return M(B(x)(M3));
	}
	
	//S(SK)
	var I_ = this.I_ = this.identity_ = this.idiot_ = S(S(K));
	//BW
	var W_ = this.W_ = this.warbler_ = B(W);

	//C_F_
	var V_ = this.V_ = this.vireo_ = C_(F_);
	
	//B(BW)
	var W__ = this.W__ = this.warbler__ = B(B(W));
	//BC_
	var C__ = this.C__ = this.cardinal__ = B(C_);
	//BR_
	var R__ = this.R__ = this.robin__ = B(R_);
	//BF_
	var F__ = this.F__ = this.finch__ = B(F_);
	//BV_
	var V__ = this.V__ = this.vireo__ = B(V_);
	
	//KI
	var KI = this.KI = this.kite = this.false = K(I);

	//MM
	//var Omega = this.omega = M(M);
	
	//KM
	var KM = this.KM = this.konstantmocker = K(M);
	//C(KM) 
	var CKM = this.CKM = this.crossedkonstantmocker = KM(C);
	//YO
	var Theta = this.theta = Y(O);

	var If = this.if = function (f) {
		return f ? K : KI;
	};
	var Not = this.not = (KI)(K);
	var Or = this.or = K;
	var And = this.and = KI;
	
	var gen = this.gen = function (f) {
		return function (g) {
			return function (x) {
				return f.call(g, x);
			}
		}
	}
	var rec = this.rec = function (f) {
		return Z(gen(f));
	}
	
	return this;
}();
Sprockets.Observer = function (notify, unsubscriber, options) {
	Sprockets.Disposable.call(this, unsubscriber);
	
	var notifier = Sprockets.Function(notify, options);
	Sprockets.define(this).getter("notify", notifier);
}
Sprockets.Observable = function (subscribe, unsubscribe) {
	var observers = new Sprockets.Collections.Mutable();
	Sprockets.define(this)
		.getter("notify", function (/*arguments*/) {
			var args = Array.prototype.slice.call(arguments);
			observers.each(function (observer) {
				observer.notify.apply(observer, args);
			});
		})
		.getter("subscribe", function (notify, options) {
			var remove = observers.remove;
			var observer = new Sprockets.Observer(notify, remove, options);
			if(subscribe) subscribe(observer);
			observers.push(observer);
			return observer;
		}
	);
	Sprockets.Disposable.call(this, function () {
		observers.each(function (observer) {
			if(unsubscribe) unsubscribe(observer);
			observer.dispose();
			delete observer;
		});
		observers.clear();
	});
}
Sprockets.Event = function (name, options) {
	Sprockets.Function.call(Sprockets.Event);
	
	var event = new CustomEvent(name);
	var bind = function (element, type, handler) {
		var listener = element.addEventListener || element.attachEvent;
		listener.call(element, type, handler, false);
	}
	var unbind = function (element, type, handler) {
		var listener = element.removeEventListener || element.detachEvent;
		listener.call(element, type, handler, false);
	}

	this.subscribe = function (element, delegate) {
		bind(element, name, delegate);
		
		return new Sprockets.Disposable(
			function () {
				element.dispatchEvent(event);
			},
			function () {
				unbind(element, name, delegate);
			}
		);
	}
}
Sprockets.Html = function (element) {
	var events = [];
	
	Sprockets.Composite.call(this, element);
	Sprockets.Disposable.call(this, function () {
		element = document.removeChild(element);
		element = null;
	});
	Sprockets.define(this).getter("subscribe", function (name, delegate) {
		var event = events[name];
		if(event === undefined) {
			event = new Sprockets.Event(name);
			events.push(event);
		}
		return event.subscribe(element, delegate);
	});
}
Sprockets.Proxy = function (element, callback) {
	var property = function (member) {
		if(member !== undefined) {
			var result = function (value) {
				if(value !== undefined) {
					if (callback) {
						if(element.hasOwnProperty(member)) {
							callback("update", member, value);
						}
						else {
							callback("create", member, value);
						}
					}
					return element[member] = value;
				}
				else {
					if (callback) {
						if(element.hasOwnProperty(member)) {
							callback("read", member, value);
						}
						else {
							callback("create", member, value);
						}
					}
					return element[member];
				}
			}
			Sprockets.Disposable.call(result, function () {
				if (callback) {
					var value = element[member];
					callback("delete", member, value);
				}
				element[member] = null;
				delete element[member];
			});
			return result;
		}
		else {
			return element;
		}
	}
	return property;
}
Sprockets.Timer = function(interval, subscribe, unsubscribe) {
	var handle;
	var self = this;
	Sprockets.Observable.call(this, subscribe, unsubscribe);
	Sprockets.define(this)
		.getter("start", function () {
			if(handle) self.stop();			
			handle = setInterval(self.notify, interval);
		})
		.getter("stop", function () { 
			clearInterval(handle); 
		});
}

Sprockets.Invoker = function (handle) {	
	return function (command) {
		return function (/*arguments*/) {
			var executed = false;
			var args = Array.prototype.slice.call(arguments);
			var proxy = new Sprockets.Proxy(handle);
			var handler = function(value) {
				if(value) proxy = new Sprockets.Proxy(value);
				return proxy();
			}
			var logic = function (/*arguments*/) {
				var innerArgs = Array.prototype.slice.call(arguments);
				if(executed === false) {			
					command.apply(handler, args);
					executed = true;
				}
			}
			
			var result = function () {
				return proxy();
			}
			Sprockets.define(result)
				.getter("redo", function(/*arguments*/) {
					var innerArgs = Array.prototype.slice.call(arguments);
					logic(innerArgs);
				})
				.getter("undo", function () {
					if(executed === true) {
						executed = false;
						command.undo.apply(handler, args);
					}
				});
				
			logic(args);
			return result;
		}
	}
}
Sprockets.Command = function (options) {
	var result = options.do;
	Sprockets.define(result).getter("undo", options.undo);
	return result;
}
Sprockets.Composite = function(prototype) {
	var handle;
	
	function get(member) {
		if(Object.prototype.toString.call(handle) === '[object Array]') {
			return Sprockets.Collections.reduce(handle, function (first, second) {
				return first[member] + second[member];
			});
		}
		else {
			return handle[member];
		}
	}
	function set(member, value) {
		if(Object.prototype.toString.call(handle) === '[object Array]') {
			Sprockets.Collections.map(handle, function (element) {
				element[member] = value;
				return element;
			});
		}
		else handle[member] = value;
	}
	
	var result = function(members) {
		if(typeof members == "function") {
			var constructor = prototype.constructor.bind.call(members);
			handle = new constructor();
		}
		else {
			handle = members;
		}
		
		return function(name) {		
			return function (value) {
				if(value) set(name, value);
				else return get(name);
			}
		}
	}
	
	result(prototype);
	return result;
}
Sprockets.Iterator = function(items) {
	var self = this;
	var data = { index: 0 };
	
	Sprockets.define(self)
		.getter("index", data, "index")
		.getter("where", function (predicate) {
			self.reset();

			var results = []
			each(function (value) {
				if (predicate(value)) {
					results.push(value);
				}
			});
			return results;
		})
		.getter("first", function () {
			self.reset();
			var result = self.current();
			return result;
		})
		.getter("last", function () {
			self.Index = items.length - 1;
			return self.current();
		})
		.getter("current", function () {
			return self.Index < items.length
				? items[self.Index]
				: null;
		})
		.getter("next", function () {
			return ++self.Index <= items.length;
		})
		.getter("previous", function () {
			return --self.Index >= 0;
		})
		.getter("reset", function () {
			self.Index = 0;
		})
		.getter("each", function (delegate) {
			Sprockets.Collections.each(items, function (value) {
				delegate(value);
			});
		});
};
Sprockets.Collections = function () {
	var self = new Object();
	Sprockets.define(self)
		.getter("every", function (array, predicate) {
			var result = true;
			self.each(array, function (element) {
				return result = result && predicate(element);
			});
			return result;
		})
		.getter("some", function (array, predicate) {
			var result = false;
			self.for(array, function (index, element) {
				return result = result || predicate(index, element);
			});
			return result;
		})
		.getter("contains", function (array, element) {
			return self.some(array, function(index, value) {
				return Sprockets.equals(element, array[index]);
			});
		})
		.getter("reduce",	function (array, aggregate) {
			var result;
			self.each(array, function (value) {
				result =  result
					? value
						? aggregate(result, value)
						: result
					: value
						? value
						: null;
			});
			return result;
		})
		.getter("map", function (array, delegate) {
			self.for(array, function (index, value) {
				array[index] = delegate(value);
			});
			return array;
		})
		.getter("filter", function (array, predicate) {
			self.for(array.reverse(), function (index, value) {
				if(predicate(value)) {
					self.removeAt(array, index);
				}
			});
			array.reverse();
			return array;
		})
		.getter("distinct",	function(array) {
			var results = [];
			self.for(array, function (index, element) {
				if (self.contains(results, element) === false) {
					results.push(element);
				}
			});
			array.length = 0;
			array.push.apply(array, results);
			return array;
		})
		.getter("indexOf", function (array, element) {
			var result = -1;
			self.for(array, function (index, value) {
				if(Sprockets.equals(element, value)) {
					result = index;
				}
			});
			return result;
		})
		.getter("add", function(array/*, elements*/) {
			var args = Array.prototype.slice.call(arguments, 1);
			array.push.apply(array, args);
			return array;
		})
		.getter("addAt", function(array, index/*, elements*/) {
			var args = Array.prototype.slice.call(arguments, 2);
			args.splice(0, 0, index, 0);
			array.splice.apply(array, args);
			return array;
		})
		.getter("remove", function (array/*, elements */) {
			var args = Array.prototype.slice.call(arguments, 1);
			self.filter(array, function (value) {
				return self.contains(args, value);
			});
			return array;
		})
		.getter("removeAt", function(array, index) {
			var rest = array.slice(index + 1);
			array.length = index;
			array.push.apply(array, rest);
			return array;
		})
		.getter("for", function (array, delegate) {
			for(var i = 0, length = array.length; i < length; i++) {
				delegate(i, array[i]);
			}
			return array;
		})
		.getter("each", function (array, delegate) {
			self.for(array, function (index, value) {
				return delegate(value);
			});
			return array;
		})
		.getter("clear", function (array) {
			while(array.length !== 0) {
				delete array.pop();
			}
			return array;
		})
	return self;
}();
Sprockets.Collections.Mutable = function (/*arguments*/) {
	var self = this;
	var base = Sprockets.Collections;
	var combinator = Sprockets.Combinators;
	var args = Array.prototype.slice.call(arguments);
	Array.apply(self, args);
	
	Sprockets.define(self)
		.getter("each", function (delegate) { return base.each(self, delegate); })
		.getter("for", function (delegate) { return base.for(self, delegate); })
		.getter("every", function (delegate) { return base.every(self, delegate); })
		.getter("some", function (delegate) { return base.some(self, delegate); })
		.getter("contains", function (element) { return base.contains(self, element); })
		.getter("map", function (delegate) { return base.map(self, delegate); })
		.getter("filter", function (predicate) { return base.filter(self, predicate); })
		.getter("distinct", function () { return base.distinct(self); })
		.getter("clear", function () { return base.clear(self); })
		.getter("add", function (/*elements*/) {
			var args = Array.prototype.slice.call(arguments);
			args.splice(0, 0, self);
			return base.add.apply(self, args);
		})
		.getter("addAt", function (index/*, elements*/) {
			var args = Array.prototype.slice.call(arguments, 1);
			args.splice(0, 0, self, index);
			return base.addAt.apply(self, args); 
		})
		.getter("remove", function (/*elements*/) {
			var args = Array.prototype.slice.call(arguments);
			args.splice(0, 0, self);
			return base.remove.apply(self, args); 
		})
		.getter("removeAt", function (index/*, elements*/) {
			var args = Array.prototype.slice.call(arguments, 1);
			return base.removeAt(self, index, args); 
		});
	
	self.add.apply(self, args);
	return self;
};
Sprockets.Collections.Mutable.prototype = new Array();
Sprockets.Collections.Immutable = function (/*arguments*/) {
	var self = this;
	var base = Sprockets.Collections;
	var combinator = Sprockets.Combinators;
	var args = Array.prototype.slice.call(arguments);
	Array.apply(self, args);
	
	Sprockets.define(self)
		.getter("every", function (delegate) { return base.every(self.slice(), delegate); })
		.getter("some", function (delegate) { return base.some(self.slice(), delegate); })
		.getter("contains", function (element) { return base.contains(self.slice(), element); })
		.getter("map", function (delegate) { return base.map(self.slice(), delegate); })
		.getter("filter", function (predicate) { return base.filter(self.slice(), predicate); })
		.getter("distinct", function () { return base.distinct(self.slice()); })
		.getter("add", function (/*elements*/) {
			var args = Array.prototype.slice.call(arguments);
			var sliced = self.slice();
			args.splice(0, 0, sliced);
			return base.add.apply(sliced, args);
		})
		.getter("addAt", function (index/*, elements*/) {
			var args = Sprockets.Array.prototype.slice.call(arguments, 1);
			var sliced = self.slice();
			args.splice(0, 0, sliced, index);
			return base.addAt.apply(sliced, args); 
		})
		.getter("remove", function (/*elements*/) {
			var args = Array.prototype.slice.call(arguments);
			var sliced = self.slice();
			args.splice(0, 0, sliced);
			return base.remove.apply(sliced, args); 
		})
		.getter("removeAt", function (index/*, elements*/) {
			var args = Array.prototype.slice.call(arguments, 1);
			return base.removeAt(self.slice(), index, args); 
		});
	
	self.push.apply(self, args);
	return self;
};
Sprockets.Collections.Immutable.prototype = new Array();
Sprockets.Singleton = function(obj) {
	var instance;
	
	return function () {
		if(instance) {
			return instance;
		}
		else {
			var result = obj.constructor.bind.apply(obj);
			var args = arguments.slice();
			instance = new result.apply(result, args);
			return instance;
		}
	}
}

new Sprockets.Html(window).subscribe("load", function () {
	var ___iframe = document.createElement("iframe");
	___iframe.style.display = "none";
	___iframe.setAttribute("name", "SprocketEnvironment");
	document.body.appendChild(___iframe);

	frames["SprocketEnvironment"].document.write(
		"<script>" +
			"parent.Sprockets.Number = Number;" +
			"parent.Sprockets.Boolean = Boolean;" +
			"parent.Sprockets.String = String;" +
			"parent.Sprockets.Date = Date;" +
			"parent.Sprockets.Object = Object;" +
			"parent.Sprockets.Array = Array;" +
		"<\/script>"
	);
    
	Sprockets.String.prototype.format = function (string) {
		var result = string.replace(/{(\d+)}/g, function (match) {
			return arguments[parseInt(match) + 1];
		});
	}
	
	Sprockets.Guid = Sprockets.clone(Sprockets.Number);
	Sprockets.Guid.prototype.constructor = function () {
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
			var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		})
	}
	document.body.removeChild(___iframe);
	frames["SprocketEnvironment"] = null;
});