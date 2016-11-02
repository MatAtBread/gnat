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
            runitl() ;
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
    if (typeof k !== 'string') {
        throw new TypeError(JSON.stringify(k)+" is not a valid name")
    }
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
                // Push args onto the stack???
                return runNative();
            }
        }
    });
    
    Object.defineProperty(vm,'cfa',{
        get(){
            return fn ;
        },
        set(cfa){
            fn = cfa ;
        },
        configurable:true,
        enumerable:true
    }) ;
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

function runitl() {
    while (vm.i !== undefined) {
        var r = vm.x[vm.i++]() ;
//        if (r && typeof r.then==='function')
//            return r.then(runitl,function(x){ throw x }) ;
    }
}

function immediate(fn) {
    fn.immediate = true ;
    return fn ;
};

var corelib = {
    create(name){
        var start = vm.x.length ;
        ConcatenativeFunction.define(name,start) ;
    },
    does:immediate(function(){
        var start = vm.x.length+2 ;
        vm.compiling = function(){
            var data = vm.cfa() ; ;
            vm.cfa = function runDoes(){
                vm.s.push(data) ;
                vm.i = start ;
                runitl() ;
            } ;
        } ;
        vm.x.push(vm.compiling) ;
        vm.x.push(corelib.exit) ;
    }),
    data(a){ vm.x.push(a) },
    define(name){
        var start = vm.x.length ;
        vm.compiling = function(){
            vm.r.push(vm.i) ;
            vm.i = start ;
            if (vm.r.length===1)
                runitl() ;
        } ;
        ConcatenativeFunction.define(name,vm.compiling)
    },
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
    load(a){ return vm.x[a] },
    store(v,a){ return vm.x[a] = v },
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
    calljs(fn) {
        return fn.apply(null,vm.s.splice(vm.s.length-fn.length,fn.length)) ;
    },
    add(a,b) { return a+b },
    sub(a,b) { return a-b },
    mul(a,b) { return a*b },
    div(a,b) { return a/b },
//    '+'(a,b) { return corelib.add.apply(this,arguments) },
    print(a) { console.log("CAT>",a) },
    'debugger'() { debugger } 
} ;

function aNativeFunction(x,y) {
    console.log("I am native",x+y)
}

ConcatenativeFunction.import(corelib);

C
('dup').define (0).pick .return

/*
('test').define
    (123,456).add
    (11).swap.print.print
    .return

('mat').define
    ("Hello Mat").print
    .test
    ("ok").print
    .return

('Hi').define.immediate
    ('hi, immediately').print
    .return

('a').define
    (123).Hi.print.return

('var').define
    .swap .create .data
    .return
*/
('printer').define
    .dup .create .data
    .does .load .print
    .return


('hello').printer
('Matthew').printer

.hello
.Matthew

/*('native').define
    .create .data
    .does .calljs
    .return
*
([9,5,2],'cjs').var
.cjs .dup .print .load .print
/*
('aNativeFunction',aNativeFunction).native
*/

/*
function delay() {
    return new Promise((function ($return, $error) {
        console.log("start delay") ;
        setTimeout(function () {
            console.log("end delay") ;
            return $return(10);
        }, 500);
    }).bind(this));
}

C('xxx').define
    ('start').print
    (delay).calljs
    ('end').print
    .return
    
.xxx()    
*/

//function log(z) { console.log(z) }
//C(log,888,999).native

//C.a() ;
//C.a() ;
//console.log(C.add(123,456))
console.log("----------\n",vm.s,vm.r);
console.log(Object.getOwnPropertyNames(ConcatenativeFunction.prototype).join())
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
