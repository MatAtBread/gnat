
var vm = {s:[],x:[],i:0} ;

var proto = {
  isCat:true,
  define(k,fn){
    var self = this ;
    Object.defineProperty(this,k,{
      get(){
        Object.setPrototypeOf(fn,self) ;
        return this.call(fn) ;
      }
    })
  },
  call(fn){
    var self = this ;
    var pusher = function(){
      var res = fn.apply(null,vm.s.splice(vm.s.length-fn.length,fn.length)) ;
      if (res!==undefined)
        vm.s.push(res) ;
      return self ;
    } ;
    pusher.valueOf = function() { return "CALL "+fn.toString()} ;
    this.compile(pusher) ;
    return this ;
  },
  compile(z){ vm.x.push(z) },
  lit() {
    // Push the literals onto the stack
    var args = [].slice.call(arguments) ;
    var pusher = function(){ vm.s.push.apply(vm.s,args)} ;
    pusher.valueOf = function(){ return "LITERAL "+args} ;
    this.compile(pusher) ;
    // pusher() ;
    return this ;
  },
  get here(){
    var self = this ;
    this.compile(function here(){ self.here$ }) ;
    return this ;
  },
  get here$(){
    vm.s.push(vm.i) ;
    return this ;
  },
  exec(){
    for (vm.i=0; vm.i<vm.x.length; vm.i++)
      vm.x[vm.i]() ;
    // Return the stack
    return vm.s ;
  }
} ;

Object.setPrototypeOf(proto,Function.prototype) ;

var corelib = {
  add(a,b) { return a+b },
  '+'(a,b) { return corelib.add.apply(this,arguments) },
  print(a) { console.log("CAT>",a) },
  nop(){}
} ;

Object.keys(corelib).forEach(k => proto.define(k,corelib[k])) ;

function cat(){
  return this.exec() ;
}

Object.setPrototypeOf(cat,proto) ;

/*var z = cat("").lit(20,10,7).add.print ;
console.log(z.lit(50).add) ;
console.log(vm) ;
z()*/

//console.log(cat.lit([4,8,6,2]).call( q => q.map(r=>r*r) ).print()) ;

//var hereFn = cat.lit(1234).here.add.print;
//console.log(hereFn());

console.log(cat.lit(10).lit(20).add.print())
console.log(vm);
