//mathober26 - k-cyclic )
let t=0
let theNumberOfFriends=100
function setup() {
	theSizeThatFits = min(windowWidth, windowHeight)*0.9
	theCanvasThatIsFilled=createCanvas(theSizeThatFits, theSizeThatFits);
	background(20,70,80);
noStroke()
	noFill()
	describe("nested polygons of many different numbers of sides and shades of teal rotate in what makes jittery, or wavy lines as you go toward the edge. ")
}

function draw() {
	t+=0.00001
  translate(width/2,width/2)
  	for(let i=0;i<theNumberOfFriends;i++){
      
		push()
      a = 2*PI*cos(i/(1+t)+2*PI/theNumberOfFriends+t)
      rotate(a)
      stroke(20+60*abs(cos(i-a*2+t)),70+130*abs(cos(i-a*2+t)),80 +140*abs(cos(i-a*2+t)),50)
      polygonMe(floor((i)%20)+3, i*5)

      pop()
    }
}
function polygonMe(n,r){
	beginShape()
	for(let i = 0;i<n;i++){
		vertex(r*cos(i*2*PI/n),r*sin(i*2*PI/n))
	}
	endShape(CLOSE)
}

function keyPressed(){
	if(keyCode===83){
		save(theCanvasThatIsFilled,"cyclic","png")
	}
}