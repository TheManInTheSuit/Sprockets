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
				var parentProperty = argument[property];
				
				if (typeof parentProperty == "function") {
					sender[property] = function () {
						this.base = function () {
							return Function.call(parentProperty, arguments);
						}
					}
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
	equals: function(sender, other) {
		var result = true;
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
};

Sprockets.Disposable = function (unsubscriber, handle) {
	var _handle, _unsubscriber, _isDisposed;

	_handle = handle;
	_unsubscriber = unsubscriber;
	_isDisposed = false;

	this.dispose = function () {
		_unsubscriber(_handle);
		_isDisposed = true;
	}
	this.__defineGetter__("isDisposed", function () { return _isDisposed; });
}

Sprockets.Function = function (delegate, options) {
	var self = this;
	var interval = options ? (options.delay || 0) : 0;
	self.options = options || { };
	
	var async = {
		completed: false,
		state: null
	}

	var invoke = function (/*arguments*/) {
		var args = arguments;		
		var handle = setTimeout(function () {
			async.state = function () {
				var result;

				try {
					result = delegate.apply(delegate, args);
					if(self.options.done) self.options.done(result);
				}
				catch (error) {
					if (self.options.fail) self.options.fail(error);
				}
				finally {
					if (self.options.always) self.options.always();
				}
				if (self.options.then) self.options.then();
		
				return result;
			}.apply(async.state, args);
			
			async.completed = true;
		}, interval);
		
		return new Sprockets.Disposable(function () {
			clearTimeout(handle);
			async.completed = true;
		});
	}
	Sprockets.implement(invoke, Sprockets.Function.prototype);
	invoke.__defineGetter__("options", function () {
		return self.options;
	});
	invoke.__defineGetter__("state", function () { 
		return async.state; 
	});
	invoke.__defineGetter__("completed", function () { 
		return async.completed;
	});
	return invoke;
}
Sprockets.Function.prototype = {
	delay: function(value) { 
		this.options.delay = { get: function () { return value; } } 
		return this;
	},
	done: function(delegate) {
		this.options.done = delegate;
		return this;
	},
	fail: function(delegate) { 
		this.options.fail = delegate;
		return this;
	},
	always: function(delegate) { 
		this.options.always = delegate;
		return this;
	},
	then: function(delegate) { 
		this.options.then = delegate;
		return this;
	}
}

Sprockets.Observer = function (notify, unsubscriber, options) {
	var result = new Sprockets.Function(notify, options);
	Sprockets.Disposable.call(result, unsubscriber);
	return result;
}

Sprockets.Observable = function () {
	var self = this;
	self.observers = new Sprockets.Array();
	
	Sprockets.Disposable.call(self, function () {
		self.observers.each(function(observer) {
			observer.dispose();
			delete observer;
		});
		self.observers.clear();
	});
}
Sprockets.Observable.prototype = {
	notify: function (value) {
		var self = this;
		this.observers.each(function(observer) {
			observer(value);
		});
	},
	subscribe: function (notify, options) {
		var index = this.observers.length;
		var remove = this.observers.remove;
		var observer = new Sprockets.Observer(notify, remove, options);

		this.observers.add(observer);
		return observer;
	}
}

Sprockets.Proxy = function (element, callback) {
	var result = function (name) {
		var property = function (value) {
			if (value) result[name] = value;
			else return result[name];
		}
		Sprockets.Disposable.call(property, function () {
			var value = element[name];
			delete element[name];

			if (callback) {
				callback("delete", name, value);
			}
		});
		property.sync = function() {
			var _value = element[name];

			if (result.hasOwnProperty(name) == false) {
				if (element.hasOwnProperty(name) == false) {
					if(callback) {
						callback("create", name, _value);
					}
					element[name] = _value;
				}
				result.__defineGetter__(name, function () {
					_value = element[name];
					if(callback) {
						callback("read", name, _value);
					}
					return _value;
				});
				result.__defineSetter__(name, function (value) {
					_value = element[name] = value;
					if(callback) {
						callback("update", name, _value);
					}
				});
			}
		}
		property.sync();
		return property;
	}
	result.sync = function() {
		for (var property in element) {
			if (element.hasOwnProperty(property)) {
				result(property);
			}
		}
	}
	result.sync();
	return result;
}

Sprockets.Event = function (name, options) {
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
		
		var logic = function () {
			element.dispatchEvent(event);
		}
		
		Sprockets.Disposable.call(logic, function () {
			unbind(element, name, delegate);
		});
		
		return logic;
	}
}

Sprockets.Events = (function () {
	var bind = function (element, type, handler) {
		if (element.addEventListener) {
			element.addEventListener(type, handler, false);
		}
		else {
			element.attachEvent('on' + type, handler);
		}
	}
	var unbind = function (element, type, handler) {
		if (element.removeEventListener) {
			element.removeEventListener(type, handler, false);
		}
		else {
			element.detachEvent('on' + type, handler);
		}
	}
	return function (element, name, delegate) {
		var event = new Event(name);
		bind(element, name, delegate);

		var result = function () {
			element.dispatchEvent(event);
		}
		Sprockets.Disposable.call(result, function () {
			unbind(element, name, delegate);
		});
		
		return result;
	}
})();

Sprockets.Timer = function(interval) {
	var self = this;
	var observers = new Sprockets.Array();
	var handle;
	
	var logic = function () {
		observers.each(function (observer) {
			observer();
		});
	}
	
	self.subscribe = function(delegate, options) {
		var observer = new Sprockets.Observer(delegate, options);
		var disposable = new Sprockets.Disposable(function () {
			observers.remove(observer);
		});
		
		observers.add(observer);
		return disposable;
	}
	self.start = function () { 
		handle = setInterval(logic, interval); 
	}
	self.stop = function () { 
		clearInterval(handle); 
	}
}



Sprockets.Invoker = function () {
	var handle = (function () {
		var _value = null;
		return function (value) {
			if(value) {
				_value = new Sprockets.Proxy(value);
			}
			return _value; 
		}
	})();
	var property = (function() {
		var _value = null;
		return function (value) {
			if(value) {
				var element = handle();
				_value = element(value);
			}
			return _value;
		}
	})();
	
	this.bind = function(element, member) {
		handle(element);
		handle().sync();
		if(member) {
			property(member);
			property().sync();
		}
	}
	
	this.visit = function(command) {
		command.data = property();
	}
}
Sprockets.Command = function (options) {
	var self = this;
	
	var result = function () {
		var args = arguments;
		this.undo = function () { 
			options.undo.apply(result.data, args); 
		}

		options.execute.apply(result.data, args);
		return this;
	}
	return result;
}

Sprockets.Composite = function(prototype) {
	var handle;
	
	if(typeof prototype == "function") {
		var constructor = prototype.constructor.bind.call(prototype);
		prototype = new constructor();
	}
	function get(member) {
		if(Object.prototype.toString.call(handle) === '[object Array]') {
			var distinct = handle;//Sprockets.Collections.distinct.call(handle);
			return Sprockets.Collections.reduce.call(distinct, function (first, second) {
				return first
					? second
						? first + second[member]
						: first
					: second
						? second[member]
						: null;
			});
		}
		else {
			return handle[member];
		}
	}
	function set(member, value) {
		if(Object.prototype.toString.call(handle) === '[object Array]') {
			Sprockets.Collections.map.call(handle, function (element) {
				element[member] = value;
				return element;
			});
		}
		else handle[member] = value;
	}
	
	for(var member in prototype) {
		this[member] = (function() {
			var name = member;
			
			return function (value) {
				if(value) set(name, value);
				else return get(name);
			}
		})();
	}
	
	this.bind = function (element) {
		handle = element;
	}
}

Sprockets.Iterator = function(items) {
	var self = this, index = 0;
	
	items = items || [];
	
	self.__defineGetter__("Collection", function () { return items; });
	self.__defineGetter__("Index", function () { return index; });
	
	self.where = function (predicate) {
		self.reset();

		var results = []
		each(function (value) {
			if (predicate(value)) {
				results.push(value);
			}
		});
		return results;
	}
	
	self.first = function () {
		self.reset();
		var result = self.current();
		return result;
	}
	
	self.last = function () {
		self.Index = items.length - 1;
		return self.current();
	}
	
	self.current = function () {
		return self.Index < items.length
			? items[self.Index]
			: null;
	}
	
	self.next = function () {
		return ++self.Index <= items.length;
	}
	
	self.previous = function () {
		return --self.Index >= 0;
	}
	
	self.reset = function () {
		self.Index = 0;
	}
	
	self.each = function (delegate) {
		for (var index = 0, length = items.length; index < length; index++) {
			var item = items[index];
			var newItem = delegate(item);
			if(newItem) items[index] = newItem;
		}
	}
};
Sprockets.Collections = {
	each: function (delegate) {
		var iterator = new Sprockets.Iterator(this);
		iterator.each(delegate);
	},
	clear: function () {
		while(this.length !== 0) {
			delete this.pop();
		}
	},
	add: function (/* arguments */) {
		this.push.apply(this, arguments);
	},
	remove: function (/* arguments */) {
		var __iterator, __argument, __results, __length, __value;

		__length = this.length;
		__results = new Sprockets.Array();

		if (__iterator === 0) {
			throw new Error("Invalid Arguments");
		}
		while (__length-- > 0) {
			__value = this.pop();
			__iterator = arguments.length;
			
			while (__iterator-- > 0) {
				__argument = arguments[__iterator];

				if (__value !== __argument) {
					__results.push(__value);
				}
			}
		}

		__length = __results.length;
		while (__length-- != 0) {
			this.push(__results.pop());
		}
	},
	filter: function (delegate) {
		var __array, __value, __condition, __i;

		__array = new Sprockets.Array();
		__value;
		__condition;
		__i = this.length;

		while (__i-- != 0) {
			__value = this.pop();
			__condition = delegate(__value);

			if (__condition === true) {
				__array.push(__value);
			}
		}

		__i = __array.length;
		while (__i-- != 0) {
			__value = __array.pop();
			this.push(__value);
		}
	},
	map: function (delegate) {
		var result = new Sprockets.Array();
		Sprockets.Collections.each.call(this, function (element) {
			result.push(delegate(element));
		});
		
		return result;
	},
	reduce: function (delegate) {
		var _result;

		for (var i = 0, length = this.length; i < length; i++) {
			_result = delegate(_result, this[i]);
		}
		return _result;
	},
	contains: function (element) {
		var result = false;
		for (var i = 0, length = this.length; i < length; i++) {
			var item = this[i];
			result = Sprockets.equals(item, element);
			if(result === true) break;
		}
		return result;
	},
	distinct: function () {
		var self = this;
		var array = this[0];
		var result = new Sprockets.Array();
		
		for (var i = 0, length = array.length; i < length; i++) {
			var element = array[i];
			
			var contains = result.contains(element);
			if (contains === false) {
				result.add(element);
			}
		};
		
		return result;
	}
};

Sprockets.Singleton = function(obj) {
	var instance;
	
	return function () {
		if(instance) {
			return instance;
		}
		else {
			var result = obj.constructor.bind.apply(obj);
			instance = new result();
			console.log(instance);
			return instance;
		}
	}
}

Sprockets.Events(window, "load", function () {
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
	
	Sprockets.Html = function (element) {
		this.on = function (name, delegate) {
			return Sprockets.Events(element, name, delegate);
		}

		var disposable = new Sprockets.Disposable(function () {
			element = document.removeChild(element);
			element = null;
		});
		var _onDispose = this.on("dispose", disposable.dispose);

		this.dispose = _onDispose;
		this.__defineGetter__("isDisposed", function () { 
			return disposable.isDisposed; 
		});
	}
    
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
	
	
	//Sprockets.implement(Sprockets.Array.prototype, Sprockets.Collections);
	document.body.removeChild(___iframe);
	frames["SprocketEnvironment"] = null;
});

(function _init() {

    function _setGlobalDefinition() {
        if (window && Sprockets.Environment == window) {
            window.Sprockets = Sprockets;
        }
        else {
            throw new Exception("Error: the window object must exist as the executing Javascript runtime environment.");
        }
    }

    _setGlobalDefinition();
})();
