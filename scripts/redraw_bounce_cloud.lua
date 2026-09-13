local frameW, frameH, frameCount = 128, 116, 4
local outAse = "/Users/hanjiho/Project/cloud_cat_game/assets/cloud-bounce-animation.aseprite"
local outPng = "/Users/hanjiho/Project/cloud_cat_game/assets/cloud-bounce-sheet.png"

local C = {
  clear=Color{r=0,g=0,b=0,a=0}, edge=Color{r=88,g=49,b=190,a=255},
  purple=Color{r=145,g=65,b=238,a=255}, pink=Color{r=246,g=87,b=225,a=255},
  pale=Color{r=244,g=184,b=255,a=255}, white=Color{r=255,g=249,b=255,a=255},
  shade=Color{r=184,g=112,b=243,a=255}, deep=Color{r=106,g=61,b=205,a=255},
  cyan=Color{r=170,g=246,b=255,a=255}
}

local function px(img,x,y,c) if x>=0 and y>=0 and x<frameW and y<frameH then img:drawPixel(x,y,c) end end
local function rect(img,x,y,w,h,c) for yy=y,y+h-1 do for xx=x,x+w-1 do px(img,xx,yy,c) end end end
local function ellipse(img,cx,cy,rx,ry,c)
  for y=-ry,ry do for x=-rx,rx do
    if (x*x)/(rx*rx)+(y*y)/(ry*ry)<=1 then px(img,cx+x,cy+y,c) end
  end end
end
local function spark(img,x,y,c)
  px(img,x,y-3,c); px(img,x,y+3,c); px(img,x-3,y,c); px(img,x+3,y,c)
  rect(img,x-1,y-1,3,3,C.white)
end
local function chevron(img,cx,y,size)
  for i=0,size do
    rect(img,cx-i,y+i,2,2,C.edge); rect(img,cx+i-1,y+i,2,2,C.edge)
  end
  for i=1,size-1 do
    px(img,cx-i,y+i,C.white); px(img,cx+i,y+i,C.white)
  end
end
local function energyArrow(img,cx,baseY,height,size)
  local top=baseY-height
  rect(img,cx-2,top+size,5,math.max(2,height-size),C.purple)
  rect(img,cx-1,top+size+1,2,math.max(1,height-size-2),C.pink)
  chevron(img,cx,top,size)
  if height>18 then chevron(img,cx,top+10,size-1) end
end

local function drawFrame(i)
  local img=Image(frameW,frameH,ColorMode.RGB); img:clear(C.clear)
  local bodyY={87,89,86,84}
  local bodyRy={16,14,17,18}
  local shifts={{0,1,0,1,0},{-1,1,0,1,-1},{0,-1,1,-1,0},{1,0,-1,0,1}}
  local xs={24,44,64,84,104}; local rs={16,18,20,18,16}; local y=bodyY[i]

  -- Complete cloud body is rebuilt for every frame.
  ellipse(img,64,y+7,58,bodyRy[i],C.edge)
  ellipse(img,64,y+5,55,bodyRy[i]-2,C.purple)
  ellipse(img,64,y+2,52,bodyRy[i]-3,C.pale)
  for n=1,5 do
    local cy=y-5+shifts[i][n]
    ellipse(img,xs[n],cy,rs[n],12,C.edge)
    ellipse(img,xs[n],cy-1,rs[n]-2,10,C.pale)
    ellipse(img,xs[n],cy-3,rs[n]-4,7,C.white)
  end
  ellipse(img,64,y+11,48,7,C.deep)
  ellipse(img,64,y+8,49,7,C.shade)
  for n=1,5 do ellipse(img,xs[n],y+1+shifts[i][n],rs[n]-5,5,C.pale) end

  -- Arrows emerge directly above the surface and rise through the four frames.
  local heights={8,18,29,40}; local h=heights[i]; local base=y-12
  energyArrow(img,64,base,h,8)
  energyArrow(img,38,base+2,math.max(7,h-9),6)
  energyArrow(img,90,base+2,math.max(7,h-9),6)
  local sy=base-4-(i-1)*7
  spark(img,17+(i-1)*2,sy+5,C.pink); spark(img,111-(i-1)*2,sy,C.cyan)
  if i>=2 then spark(img,51,sy-5,C.white) end
  if i>=3 then spark(img,78,sy-2,C.pink) end
  return img
end

local sprite=Sprite(frameW,frameH,ColorMode.RGB); sprite.filename=outAse
local layer=sprite.layers[1]; layer.name="Redrawn Bounce Cloud"
local images={}
for i=1,frameCount do
  if i>1 then sprite:newEmptyFrame() end
  images[i]=drawFrame(i); sprite:newCel(layer,i,images[i],Point(0,0)); sprite.frames[i].duration=0.10
end
sprite:saveAs(outAse)

local sheet=Sprite(frameW*frameCount,frameH,ColorMode.RGB); local sl=sheet.layers[1]
local si=Image(frameW*frameCount,frameH,ColorMode.RGB); si:clear(C.clear)
for i=1,frameCount do si:drawImage(images[i],Point((i-1)*frameW,0)) end
sheet:newCel(sl,1,si,Point(0,0)); sheet:saveCopyAs(outPng); sheet:close()
app.activeSprite=sprite; app.activeFrame=1; app.refresh()
