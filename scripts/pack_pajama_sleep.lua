-- Packs ImageGen drawings; does not draw or synthesize the character.
local root=app.params['root']
local src=Image{fromFile=root..'/source.png'}
local old=Image{fromFile='assets/cat-cloud-pajamas-idle-sheet.png'}
local function bounds(img,left,top,w,h)
  local b={x0=left+w,y0=top+h,x1=left,y1=top}
  for y=top,top+h-1 do for x=left,left+w-1 do
    if app.pixelColor.rgbaA(img:getPixel(x,y))>128 then
      b.x0=math.min(b.x0,x);b.x1=math.max(b.x1,x)
      b.y0=math.min(b.y0,y);b.y1=math.max(b.y1,y)
    end
  end end
  return b
end
local ref=bounds(old,0,0,128,128)
local boxes={}
for f=0,7 do
  local col=f%4;local row=math.floor(f/4)
  local x=math.floor(col*src.width/4);local y=math.floor(row*src.height/2)
  boxes[f+1]=bounds(src,x,y,math.floor((col+1)*src.width/4)-x,math.floor((row+1)*src.height/2)-y)
end
-- Match the original awake sprite footprint, then use the SAME calibration
-- for every frame (never independently enlarge a sleepy pose).
local scale=(ref.y1-ref.y0+1)/(boxes[1].y1-boxes[1].y0+1)
local scaleX=(ref.x1-ref.x0+1)/(boxes[1].x1-boxes[1].x0+1)
local anim=Sprite(128,128,ColorMode.RGB)
local sheet=Image(1024,128,ColorMode.RGB);sheet:clear()
local durations={1.8,0.4,0.4,0.4,0.5,0.7,0.7,0.7}
for f=0,7 do
  local b=boxes[f+1]
  local w=math.floor((b.x1-b.x0+1)*scaleX+0.5)
  local h=math.floor((b.y1-b.y0+1)*scale+0.5)
  assert(w<=128 and h<=112,'Generated frame exceeds original canvas')
  local img=Image(128,128,ColorMode.RGB);img:clear()
  local dx=math.floor((ref.x0+ref.x1+1-w)/2)
  local dy=ref.y1+1-h
  for y=0,h-1 do for x=0,w-1 do
    local p=src:getPixel(math.min(b.x1,b.x0+math.floor(x/scaleX)),math.min(b.y1,b.y0+math.floor(y/scale)))
    img:drawPixel(dx+x,dy+y,p)
    sheet:drawPixel(f*128+dx+x,dy+y,p)
  end end
  if f>0 then anim:newEmptyFrame() end
  anim:newCel(anim.layers[1],f+1,img,Point(0,0))
  anim.frames[f+1].duration=durations[f+1]
  print('frame '..(f+1)..': '..w..'x'..h..', feet='..(dy+h))
end
local tag=anim:newTag(1,5);tag.name='fall-asleep'
tag=anim:newTag(6,8);tag.name='sleep-breathing'
sheet:saveAs(root..'/sleep-sheet-v1.png')
anim:saveAs(root..'/sleep-v1.aseprite')
anim:saveAs(root..'/sleep-preview-v1.gif')
print('Original frame bounds: '..(ref.x1-ref.x0+1)..'x'..(ref.y1-ref.y0+1))
