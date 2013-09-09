var Sprockets = {
    Environment: window || this,
    Directory: "",
    Filename: "Sprockets.compiled.js",
    Version: "v1.0.0"
}; 
Sprockets.Objects = {
    inherit: function (object) {
        var _result = function () { };
        _result.prototype = object;
        return new _result();
    },
    clone: function (obj) {
        if (obj === null || typeof obj !== 'object') return obj;

        var copy = obj.constructor();
        for (var property in obj) {
            copy[property] = Sprockets.Objects.clone(obj[property]);
        }

        return copy;
    }
};
Sprockets.decorate = function (from) {
    var parent = from.prototype;
    var prototype = parent.constructor.call(this, arguments.slice(1, 1));

    for (var property in from) {
        if (parent.hasOwnProperty(property)) {
            var parentProperty = parent[property];
            if (typeof parentProperty == "function") {
                prototype[property] = function () {
                    this.base = function () {
                        return Function.call(parentProperty, arguments);
                    }
                }
            }
        }
        else {
            prototype[property] = from[property];
        }
    }

    var object = function () { }
    object.prototype = prototype;
    object.decorate = arguments.callee;
    return object;
}
Sprockets.pool = function (prototype) {
    var objects = []
    var self = this;

<<<<<<< HEAD
    function _import(path) {
        var _scriptTag, _headers;
        
        _scriptTag = document.createElement("script");
        _scriptTag.type = "application/javascript";
        _scriptTag.src = path;
    
        _headers = document.getElementsByTagName("head");
        if (_headers.length == 1) {
            _headers[0].appendChild(_scriptTag);
=======
    var value = function (/*arguments*/) {
        var result = this;
        if (objects.length == 0) {
            prototype.constructor.call(result, arguments);
        }
        else {
            result = objects.pop();
            this.call(result, arguments);
>>>>>>> Vast cleanup
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
}
Sprockets.memento = function (object) {
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
}
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
Sprockets.Notifier = function (notify, options) {
    var self = function (/*arguments*/) {
        var result;

        try {
            result = notify(arguments);
            if(self.done) self.done(result);
        }
        catch (error) {
            if (self.fail) self.fail(error);
            return;
        }
        finally {
            if (self.always) self.always();
        }
        if (self.then) self.then();
    };

    if (options) with (options) {
        self.__defineGetter__("done", done);
        self.__defineGetter__("fail", fail);
        self.__defineGetter__("always", always);
        self.__defineGetter__("then", then);
    }

    return self;
}
Sprockets.Observer = function (notify, unsubscriber, options) {
    return function (value) {
        var notifier = new Sprockets.Notifier(notify, options);
        var disposable = new Sprockets.Disposable(unsubscriber, notifier);
        var self = function () { notifier(value); }
        self.done = function (func) { notifier.done = func; }
        self.fail = function (func) { notifier.fail = func; }
        self.always = function (func) { notifier.always = func; }
        self.then = function (func) { notifier.then = func; }
        self.dispose = disposable.dispose
        self.__defineGetter__("isDisposed", function () { return disposable.isDisposed });
        return self;
    }
}
Sprockets.Observable = function (handle) {
    var _observers = [];

    var result = function (value) {
        if (value) {
            handle = value;
            for (var i = 0, length = _observers.length; i < length; i++) {
                var observer = _observers[i];
                var notifier = observer(value);
                notifier();
            }
        }

        else return handle;
    }
    result.subscribe = function (notify, options) {
        var _index = _observers.length;

        var observer = new Sprockets.Observer(notify, function (value) {
            _observers.splice(_index, 1);
        }, options);

        _observers.push(observer);
        return observer;
    };

    var disposable = new Sprockets.Disposable(function () {
        for(var i = 0, length = _observers.length; i < length; i++) {
            _observers[i].dispose();
            delete _observers[i];
        }
        _observers = [];
    }, handle);
    result.dispose = disposable.dispose;
    result.__defineGetter__("isDisposed", function () { return disposable.isDisposed; });

    return result;
}
Sprockets.Proxy = function (element, callback) {
    var result = function (name) {
        var disposable = new Sprockets.Disposable(function () {
            var property = element[name];
            delete element[name];

            if (callback) {
                callback("delete", name, property);
            }
        });
        var property = function (value) {
            if (value) result[name] = value;
            else return result[name];
        }
        property.dispose = disposable.dispose;
        property.__defineGetter__("isDisposed", function () { return disposable.isDisposed; });
        property.sync = function() {
            var _value = element[name];

            if (result.hasOwnProperty(name) == false) {
                if (element.hasOwnProperty(name) == false) {
                    callback("create", name, _value);
                    element[name] = _value;
                }
                result.__defineGetter__(name, function () {
                    _value = element[name];
                    callback("read", name, _value);
                    return _value;
                });
                result.__defineSetter__(name, function (value) {
                    _value = element[name] = value;
                    callback("update", name, _value);
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

        var disposable = new Sprockets.Disposable(function () {
            unbind(element, name, delegate);
        });
        var result = function () { element.dispatchEvent(event); }
        result.dispose = disposable.dispose;
        result.__defineGetter__("isDisposed", function () { return disposable.isDisposed; });
        return result;
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
        var disposable = new Sprockets.Disposable(function () {
            unbind(element, name, delegate);
        });

        var result = function () {
            element.dispatchEvent(event);
        }
        result.dispose = disposable.dispose;
        result.__defineGetter__("isDisposed", function () { return disposable.isDisposed; });
        return result;
    }
})();
Sprockets.Timer = function(interval) {
    var _observers = [];

    this.subscribe = function(delegate) {
        var handle = setInterval(delegate, interval);
        var disposable = new Sprockets.Disposable(function() {
            clearInterval(handle);
        });
        _observers.push(disposable);
    }

    var disposable = new Sprockets.Disposable(function() {
        for(var i = 0, length = _observers.length; i < length; i++) {
            _observers[i].dispose();
            _observers[i] = null;
        }
        _observers = [];
    });
    this.dispose = disposable.dispose;
    this.__defineGetter__("isDisposed", function() { return disposable.isDisposed; });
}
Sprockets.Function = function (delegate, options) {
    var interval = options ? (options.delay || 0) : 0;
    var async = {
        completed: false,
        state: null
    }

    var invoke = function (fn) {
        var handle = setTimeout(function () {
            async.state = delegate(fn.arguments);
            async.completed = true;
        }, interval);
        return new Sprockets.Disposable(function () {
            clearTimeout(handle);
            async.completed = true;
        });
    }

    var result = this;
    result.invoke = function (/*arguments*/) { return invoke(this); }
    result.__defineGetter__("state", function () { return async.state; });
    result.__defineGetter__("completed", function () { return async.completed; });
    return result;
}
Sprockets.Command = function (delegate, undo) {
    this.undo = undo;
    this.invoke = delegate;
}
Sprockets.Iterator = function (items) {
    var index = 0;

    function doPredicate(direction) {
        while (direction()) {
            var current = current();
            if (predicate(current)) {
                return current;
            }
        }
        return null;
    }
    this.where = function (predicate) {
        this.reset();

        var results = []
        each(function (value) {
            if (predicate(value)) {
                results.push(value);
            }
        });
        return results;
    }
    this.first = function (predicate) {
        this.reset();

        if (predicate) {
            return doPredicate(next);
        }
        else return this.current();
    }
    this.last = function (predicate) {
        index = items.length - 1;

        if (predicate) {
            return doPredicate(previous);
        }
        else return this.current();
    }
    this.current = function () {
        return index < items.length
            ? items[index]
            : null;
    }
    this.next = function () {
        return ++index <= this.items.length;
    }
    this.previous = function () {
        return --index >= 0;
    }
    this.reset = function () {
        index = 0;
    }
    this.each = function (delegate) {
        for (var item = this.first(); this.next(); item = this.current()) {
            delegate(item);
        }
    }
}
Sprockets.Events(window, "load", function () {
    var ___iframe = document.createElement("iframe");
    ___iframe.style.display = "none";
    ___iframe.setAttribute("name", "SprocketEnvironment");
    document.body.appendChild(___iframe);

    var _number, _boolean, _string, _date, _object, _array;

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

    with (window.Sprockets) {
        _number = Number;
        _boolean = Boolean;
        _string = String;
        _date = Date;
        _object = Object;
        _array = Array;
    }

    //window.Sprockets.Object = _object;
    window.Sprockets.Object = function (element) {
        console.log("new element");
        this.on = function (name, delegate) {
            return Sprockets.Events(element, name, delegate);
        }

        var disposable = new Sprockets.Disposable(function () {
            element = document.removeChild(element);
            element = null;
        });
        var _onDispose = this.on("dispose", disposable.dispose);

        this.dispose = _onDispose;
        this.__defineGetter__("isDisposed", function () { return disposable.isDisposed; });
    }
    window.Sprockets.Number = _number;
    window.Sprockets.Boolean = _boolean;
    window.Sprockets.String = _string;
    window.Sprockets.String.prototype.format = function (string) {
        var result = string.replace(/{(\d+)}/g, function (match) {
            return arguments[parseInt(match) + 1];
        });
    }
    window.Sprockets.Date = _date;
    window.Sprockets.Guid = Sprockets.Objects.inherit(Sprockets.Number);
    window.Sprockets.Guid.prototype.constructor = function () {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        })
    }
    window.Sprockets.Collections = {
        add: function (array /* arguments */) {
            var _results, _iterator, _length;

            _results = Sprockets.Array();
            _length = arguments.length;
            _results.addRange(array);

            for (_iterator = 1; _iterator < _length; _iterator++) {
                _results.push(arguments[_iterator]);
            }

            return _results;
        },
        remove: function (array /* arguments */) {
            var _results, _iterator, _length;

            _results = Sprockets.Array();
            _length = arguments.length;
            _results.addRange(array);

            for (_iterator = 1; _iterator < _length; _iterator++) {
                _results.remove(arguments[_iterator]);
            }

            return _results;
        },
        filter: function (array, delegate) {
            var _results;

            _results = Sprockets.Array();
            _results.addRange(array);
            _results.filter(delegate);

            return _results;
        },
        map: function (array, delegate) {
            var _results;

            _results = Sprockets.Array();
            _results.addRange(array);
            _results.map(delegate);

            return _results;
        },
        reduce: function (array, delegate) {
            var _results, _result;

            _results = Sprockets.Array();
            _results.addRange(array);
            _result = _results.reduce(delegate);

            return _result;
        },
        distinct: function (array) {
            var _results;

            _results = Sprockets.Array();
            _results.addRange(array);
            _results.distinct();

            return _results;
        },
        contains: function (array, object) {
            var _result, _iterator;

            _results = Sprockets.Array();
            _results.addRange(array);

            while (_iterator-- != 0) {
                if (object === _results[i]) {
                    return true;
                }
            }

            return false;
        },
        copy: function (array) {
            var _result;

            _result = new Sprockets.Array();
            _result.addRange(array);

            return _result;
        }
    };
    window.Sprockets.Array = _array;
    window.Sprockets.Array.prototype.first = function () {
        return this.length > 0 ? this[0] : null;
    }
    window.Sprockets.Array.prototype.last = function () {
        return this.length > 0 ? this[this.length - 1] : null;
    }
    window.Sprockets.Array.prototype.add = function (/* arguments */) {
        for (var i = 0, length = arguments.length; i < length; i++) {
            this.push(arguments[i]);
        }
    }
    window.Sprockets.Array.prototype.remove = function (/* arguments */) {
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
    }
    window.Sprockets.Array.prototype.filter = function (delegate) {
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
    }
    window.Sprockets.Array.prototype.map = function (delegate) {
        var __results, __iterator, __value;

        __iterator = this.length;
        while (__iterator-- != 0) {
            __value = delegate(this[__iterator]);
            this[__iterator] = __value;
        }
    }
    window.Sprockets.Array.prototype.reduce = function (delegate) {
        var __result;

        for (var i = 0, length = this.length; i < length; i++) {
            __result = delegate(_result, this[i], i, this);
        }

        this.clear();
        this[0] = __result;
    }
    window.Sprockets.Array.prototype.distinct = function () {
        var __result, __value;

        __result = new Sprockets.Array();

        for (var i = length; --i; ) {
            __value = this[i];
            if (!__result.contains(__value)) {
                __result.push(__value);
            }
        }

        this.clear();
        this.addRange(__result);
    }
    window.Sprockets.Array.prototype.clear = function () {
        var __iterator = this.length;
        while (__iterator-- != 0) this.pop();
    }
    window.Sprockets.Array.prototype.each = function (delegate) {
        for (var i = 0, length = this.length; i < length; i++) {
            this[i] = delegate(this[i]);
        }
    }

    Sprockets = window.Sprockets;
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
