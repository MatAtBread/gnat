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

/* Force a function to be derived from a ConcantentiveFunction, with a prototype containing all other ConcantentiveFunctions, so
 * that chained getters work, eg. fn.abc.def.fn.etc */ 

var vm = {s:[],r:[],x:[]} ;

function ConcatenativeFunction(fn) {
    if (fn instanceof ConcatenativeFunction)
        return fn ;
 
    if (!(fn instanceof Function))
        throw new Error("ConcatenativeFunction: "+fn.toString()+" is not a function") ;
    
    Object.setPrototypeOf(fn,this.__proto__) ;
    fn.constructor = this.constructor ;
    return fn ;
}

/* Base ConcatenativeFunction prototypes used to compile and execute */
ConcatenativeFunction.prototype = Object.create(Function.prototype) ;

var C = new ConcatenativeFunction(function(){
    if (vm.compiling) {
        // Compile all the arguments as literals
        return compileLiterals.apply(this,arguments);
    } else {
        if (arguments.length===0) {
            while (vm.i !== undefined)
                vm.x[vm.i++]() ;
        } else {
            [].push.apply(vm.s,[].reverse.call(arguments));
        }
        return C ;
    }
}) ;

function popLiterals() {
    [].push.apply(vm.s,[].reverse.call(vm.x[vm.i++]));
}

function compileLiterals() {
    if (arguments.length) {
        vm.x.push(popLiterals,[].slice.call(arguments)) ;
    }
    return C ;
}

/* Add a native JS function to the prototypes */
ConcatenativeFunction.define = function(k,what){
    var fn ;
    if (typeof what !== "function") {
        fn = function(){ return what } ;
    } else {
        fn = what ;
    }

    function runNative() {
        // Execute the underlying function
        var r = fn.apply(null,vm.s.splice(vm.s.length-fn.length,fn.length)) ;
        
        // Push the result (if there was one) on the stack
        if (r!==vm && r!==undefined)
            vm.s.push(r) ;
        return C ;
    }
    
    Object.defineProperty(this.prototype,k,{
        enumerable:true,
        get(){
            if (vm.compiling && !what.immediate) {
                runNative.valueOf = function() {
                    return k
                };
                vm.x.push(runNative);
                return compileLiterals.apply(this,arguments);
            } else {
                return runNative.apply(this,arguments);
            }
        }
    });
} ;

/* Add a set of functions contained within an object to a prototype */
ConcatenativeFunction.import = function(lib){
    Object.getOwnPropertyNames(lib).forEach(k => {
        var desc = Object.getOwnPropertyDescriptor(lib,k) ;
        if (desc.get) {
            ConcatenativeFunction.define(k, desc.get) ;
        } else if (desc.value) {
            ConcatenativeFunction.define(k, desc.value) ;
        }
    }) ;
} ;

ConcatenativeFunction.prototype.define = function(name){
    var start = vm.x.length ;
    vm.compiling = function(){
        vm.r.push(vm.i) ;
        vm.i = start ;
        if (vm.r.length===1)
            while (vm.i !== undefined)
                vm.x[vm.i++]() ;
    } ;
    ConcatenativeFunction.define(name,vm.compiling) ;
    return C ;
};

function immediate(fn) {
    fn.immediate = true ;
    return fn ;
};

var corelib = {
    exit(){
        vm.i = vm.r.pop() ;
    },
    'return':immediate(function(){
        vm.x.push(corelib.exit) ;
        vm.compiling = undefined ;
    }),
    immediate:immediate(function(){
        immediate(vm.compiling) ;
    }),
    here(){ return vm.x.length },
    swap(a,b) { vm.s.push(b,a) },
    spread(arr){ vm.s.push.apply(vm.s,arr) },
    gather(idx){
        vm.s.push(vm.s.splice(vm.s.length-idx,idx)) ;
    },
    pluck(idx){
        return vm.s.splice(vm.s.length-idx-1,1)[0] ;
    },
    pick(idx){
        return (vm.s[vm.s.length-idx-1]) ;
    },
    drop(a) {},
    add(a,b) { return a+b },
    sub(a,b) { return a-b },
    mul(a,b) { return a*b },
    div(a,b) { return a/b },
//    '+'(a,b) { return corelib.add.apply(this,arguments) },
    print(a) { console.log("CAT>",a) },
    nop() {} // Used to compile literals
} ;

ConcatenativeFunction.import(corelib);

C
.define('test')
    (123,456).add
    (11).swap.print.print
    .return

.define('mat')
    ("Hello Mat").print
    .test
    ("ok").print
    .return

.define('Hi').immediate
    ('hi, immediately').print
    .return

.define('a')
    (123).Hi.print.return
    
C.a() ;
C.a() ;
//console.log(C.add(123,456))
//console.log(vm);

//ConcatenativeFunction.import(Math);
//ConcatenativeFunction.import(Promise);



/*
var C = new ConcatenativeFunction(function cat(){
    var self ;
    if (this instanceof ConcatenativeFunction) {
        if (arguments.length===0)
            return this.exec() ;
        self = this ;
    } else {
        self = new ConcatenativeFunction(function() { 
            return cat.apply(self,arguments) ;
        }) ;
    }
    for (var i=0; i<arguments.length;i++) {
        if (typeof arguments[i]==="function")
            self.compile(C._native) ;
        self.lit(arguments[i]) ;
    }
    return self ;
}) ;


C.begin
    (0).pick
.define('dup') ;

C.begin
    ("Hi!").print .immediate('Hi')
    .dup.Hi.mul .define('sq')
    (11).sq
    (12).sq
    (2).gather.print
.exec();

C.begin
    (20).sq.print
.exec();

C.begin
    (require) .define('require')
    ((f,o)=>o[f].bind?o[f].bind(o):o[f]) .define('dot')
    .swap.dot .define('member')
    ((f,a)=>f.apply(this,a)) .define('gojs')
    
    ('toString').member ([]).gojs .define('toString')
    
    (1).gather ('readFileSync','fs').require.dot .swap.gojs .define('readFileSync')

    ('package.json').readFileSync .toString
    .print
.exec()

console.log(vm) ;
/*
C.begin
    .here('I am here:').add.print.immediate('Here')
    (1).lit(2).add.print.Here.define('test')
    .test
()
*/
//    (1).add.define('inc')
//    (10).inc.define('WhatIs1+10');
//console.log(C.begin['WhatIs1+10']()) ;
