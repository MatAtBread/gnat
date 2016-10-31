/* Force a function to be derived from a ConcantentiveFunction, with a prototype containing all other ConcantentiveFunctions */ 
function ConcatenativeFunction(fn) {
    if (fn instanceof ConcatenativeFunction)
        return fn ;
    Object.setPrototypeOf(fn,this.__proto__) ;
    fn.constructor = this.constructor ;
    return fn ;
}

/* Add a function to a prototype */
ConcatenativeFunction.define = function(k,fn){
    if (!(fn instanceof ConcatenativeFunction))
        fn = new ConcatenativeFunction(fn) ;
    Object.defineProperty(this.prototype,k,{
        get(){
            return this.call(fn) ;
        }
    });
} ;

/* Add a set of functions contained within an object to a prototype */
ConcatenativeFunction.import = function(lib){
    Object.getOwnPropertyNames(lib).forEach(k => ConcatenativeFunction.define(k,lib[k])) ;
} ;

/* Base ConcatenativeFunction prototypes used to compile and execute */
ConcatenativeFunction.prototype = {
    // Compile into the current vm
    compile(z){ this.vm.x.push(z) },
    // Compile a call to the specified JS function
    call(fn){
        var self = this ;
        var pusher = function(){
            var res = fn.apply(null,self.vm.s.splice(self.vm.s.length-fn.length,fn.length)) ;
            if (res!==undefined) {
                if (res!==self.vm.s)
                    self.vm.s.push(res) ;
            }
            return self ;
        } ;
        pusher.valueOf = function() { return "CALL "+fn.toString() } ;
        this.compile(pusher) ;
        return this ;
    },
    // Compile a call that pushes literals
    lit() {
        if (arguments.length>0) {
            var self = this ;
            // Push the literals onto the stack
            var args = [].slice.call(arguments) ;
            var pusher = function(){ self.vm.s.push.apply(self.vm.s,args)} ;
            pusher.valueOf = function(){ return "LITERAL "+args} ;
            this.compile(pusher) ;
        }
        return this ;
    },
    // Define the current vm in its own prototype
    define(name) {
        var fn = this ;
        Object.defineProperty(Object.getPrototypeOf(fn),name,{
            get() {
                return this.call(fn) ;
            }
        }) ; 
        return C() ;
    },
    // Run the current vm
    exec(){
        for (this.vm.i=0; this.vm.i<this.vm.x.length; this.vm.i++)
            this.vm.x[this.vm.i]() ;
        // Return the stack
        return this.vm.s ;
    }
} ;

Object.setPrototypeOf(ConcatenativeFunction.prototype,Function.prototype) ;

var corelib = {
    add(a,b) { return a+b },
    '+'(a,b) { return corelib.add.apply(this,arguments) },
    print(a) { console.log("CAT>",a) },
    nop(){}
} ;

ConcatenativeFunction.import(corelib);
ConcatenativeFunction.import(Math);
//ConcatenativeFunction.import(Promise);

function compileArgs(self,args) {
    for (var i=0; i<args.length;i++) {
        if (typeof args[i]==="function")
            self.call(args[i]) ;
        else
            self.lit(args[i]) ;
    }
}

var s = [] ;
var C = new ConcatenativeFunction(function cat(){
    var self ;
    if (this instanceof ConcatenativeFunction) {
        if (arguments.length===0)
            return this.exec() ;
        self = this ;
    } else {
        self = new ConcatenativeFunction(function() { return cat.apply(self,arguments) }) ;
        self.vm = {s:s,x:[]} ;
    }
    compileArgs(self,arguments) ;
    return self ;
}) ;

var res = C()
    (1).add.define('inc')
    (10).inc();

console.log(res) ;
