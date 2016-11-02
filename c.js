/* Concatenative JavaScript

An exploration into using concatenative expressions within JavaScript. The basic trick (inspired by caternary) is to 
define getters on a prototype that always return their own reference, so that expressions like:

     Obj.abc.def.ghi
     
evaluate in JS. The getters themselves only _compile_ - they append calls to real functions onto an array associated
with each definition. The getters are conceptually similar to 'immediate' words in FORTH.

Since JS does not allow the syntax "Obj.abc.1.def", literals are passed as arguments to the getters, e.g.

     Obj.abc(1).def
     
which should be logically thought of as:

    .abc  (1) .def
    
ie: .abc compiles its runtime, (1) compiles the literal, .def compiles it's runtime. For brevity, literals can be 
comma separated (since they are actually function parameters):

    .abc  (1,'Hello',{foo:123}) .def

.abc compiles its runtime, (1,'Hello',{foo:123}) pushes three literals onto the stack (literal types are JS types), .def compiles
its runtime.

This means that the getters must return a function (so it can be optionally followed by parentheses for literals) which itself has the same 
prototype as all other concatenative functions.

Unlike FORTH, C() does not have an "interpretive" mode. Attempting to compile an empty list of literals makes the core run the last
compiled object [NB: This may change in the future for example to a word such as ".end"]

    (1).print      // Compile the literal 1 and a call to "print"
    (1).print()    // Compile the literal 1 and a call to "print", and run them

 */


/* Force a function to be derived from a ConcantentiveFunction, with a prototype containing all other ConcantentiveFunctions */ 
function ConcatenativeFunction(fn) {
    if (fn instanceof ConcatenativeFunction)
        return fn ;
    if (!(fn instanceof Function))
        throw new Error("ConcatenativeFunction: "+fn.toString()+" is not a function") ;
    
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
            return this.native(fn) ;
        }
    });
} ;

/* Add a set of functions contained within an object to a prototype */
ConcatenativeFunction.import = function(lib){
    Object.getOwnPropertyNames(lib).forEach(k => ConcatenativeFunction.define(k,
        typeof lib[k]==="function"?lib[k]:function(){ return lib[k] })) ;
} ;

/* Base ConcatenativeFunction prototypes used to compile and execute */
ConcatenativeFunction.prototype = {
    // Compile into the current vm
    compile(z){ this.vm.x.push(z) },
    // Compile a call to the specified JS ('native') function
    native(fn){
        var self = this ;
        var pusher = function(){
            var res = fn.apply(null,self.vm.s.splice(self.vm.s.length-fn.length,fn.length)) ;
            if (res && res!==self.vm.s)
                self.vm.s.push(res) ;
            return self ;
        } ;
        pusher.valueOf = function() { return "CALL "+fn.toString() } ;
        this.compile(pusher) ;
        return this ;
    },
    // Push literals
    _literal() {
        this.vm.s.push.apply(this.vm.s,this.vm.x[++this.vm.i]) ;
    },
    // Compile a call that pushes literals
    lit() {
        if (arguments.length>0) {
            var self = this ;
            // Push the literals onto the stack
            var args = [].slice.call(arguments) ;
            this.compile(self._literal) ;
            this.compile(args) ;
        }
        return this ;
    },
    // Define the current vm in its own prototype
    define(name) {
        var fn = this ;
        Object.defineProperty(Object.getPrototypeOf(fn),name,{
            get() {
                return this.native(fn) ;
            }
        }) ; 
        return K.begin ;
    },
    immediate(name) {
        var fn = this ;
        Object.defineProperty(Object.getPrototypeOf(fn),name,{
            get(){
                fn() ;
                return this ;
            }
        }) ; 
        return K.begin ;
    },
    // Run the current vm
    exec(){
        for (this.vm.i=0; this.vm.i<this.vm.x.length; this.vm.i++)
            this.vm.x[this.vm.i].call(this) ;
        // Return the stack
        return this.vm.s ;
    },
    _here(){
        this.vm.s.push(this.vm.x.length) ;
        return this ;
    },
    get here(){
        this.native(this._here) ;
        return this ;
    },
    get swap(){
        var self = this ;
        this.native(function(){
            self.vm.s.push(self.vm.s.pop(),self.vm.s.pop()) ;
        }) ;
        return this ;
    },
    get spread(){
        var self = this ;
        this.native(function(){
            var arr = self.vm.s.pop() ;
            self.vm.s.push.apply(self.vm.s,arr) ;
        }) ;
        return this ;
    },
    get gather(){
        var self = this ;
        this.native(function(){
            var idx = self.vm.s.pop() ;
            self.vm.s.push(self.vm.s.splice(self.vm.s.length-idx,idx)) ;
        }) ;
        return this ;
    },
    get pluck(){
        var self = this ;
        this.native(function(){
            var idx = self.vm.s.length-self.vm.s.pop()-2 ;
            self.vm.s.push(self.vm.s.splice(idx,1)[0]) ;
        }) ;
        return this ;
    },
    get pick(){
        var self = this ;
        this.native(function(){
            self.vm.s.push(self.vm.s[self.vm.s.length-self.vm.s.pop()-2]) ;
        }) ;
        return this ;
    },
    get end(){
        return this.exec() ;
    }
} ;

Object.setPrototypeOf(ConcatenativeFunction.prototype,Function.prototype) ;

var corelib = {
    drop(a) {},
    add(a,b) { return a+b },
    sub(a,b) { return a-b },
    mul(a,b) { return a*b },
    div(a,b) { return a/b },
//    '+'(a,b) { return corelib.add.apply(this,arguments) },
    print(a) { console.log("CAT>",a) },
    nop(){}
} ;

ConcatenativeFunction.import(corelib);
ConcatenativeFunction.import(Math);
//ConcatenativeFunction.import(Promise);

var vm = {s:[],r:[]} ;

var K = {
    C:new ConcatenativeFunction(function cat(){
        var self ;
        if (this instanceof ConcatenativeFunction) {
            if (arguments.length===0)
                return this.exec() ;
            self = this ;
        } else {
            self = new ConcatenativeFunction(function() { 
                return cat.apply(self,arguments) ;
            }) ;
            self.vm = Object.assign({},vm,{x:[]}) ;
        }
        for (var i=0; i<arguments.length;i++) {
            if (typeof arguments[i]==="function")
                self.native(arguments[i]) ;
            else
                self.lit(arguments[i]) ;
        }
        return self ;
    }),
    get begin() {
        return this.C() ;
    }
};


K.begin
    (0).pick
.define('dup') ;

K.begin
    ("Hi!").print .immediate('Hi')
    .dup.Hi.mul .define('sq')
    (11).sq
    (12).sq
    (2).gather.print
.end ;

K.begin
    (20).sq.print
.end ;

K.begin
    (require) .define('require')
    ((f,o)=>o[f].bind?o[f].bind(o):o[f]) .define('dot')
    .swap.dot .define('member')
    ((f,a)=>f.apply(this,a)) .define('gojs')
    
    ('toString').member ([]).gojs .define('toString')
    
    (1).gather ('readFileSync','fs').require.dot .swap.gojs .define('readFileSync')

    ('package.json').readFileSync .toString
    .print
.end

console.log(K.begin.vm.s) ;
/*
K.begin
    .here('I am here:').add.print.immediate('Here')
    (1).lit(2).add.print.Here.define('test')
    .test
()
*/
//    (1).add.define('inc')
//    (10).inc.define('WhatIs1+10');
//console.log(K.begin['WhatIs1+10']()) ;
