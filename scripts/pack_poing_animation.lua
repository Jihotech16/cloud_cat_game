-- Pack generated shine frames. Floating is preview positioning, not redrawn motion.
local letters={"P","O","I","N","G"}
local atlas=Image(256,320,ColorMode.RGB)
atlas:clear()
local preview=Sprite(320,72,ColorMode.RGB)
local rows={}
for index,letter in ipairs(letters) do
  local src=Image{fromFile="resources/poing-items/animation/"..letter.."-source.png"}
  local boxes={}
  local maxSize=0
  for f=0,3 do
    local left,right=math.floor(f*src.width/4),math.floor((f+1)*src.width/4)-1
    local b={x0=right,x1=left,y0=src.height-1,y1=0}
    for y=0,src.height-1 do
      for x=left,right do
        if app.pixelColor.rgbaA(src:getPixel(x,y))>128 then
          b.x0=math.min(b.x0,x); b.x1=math.max(b.x1,x)
          b.y0=math.min(b.y0,y); b.y1=math.max(b.y1,y)
        end
      end
    end
    boxes[f+1]=b
    maxSize=math.max(maxSize,b.x1-b.x0+1,b.y1-b.y0+1)
  end
  local scale=56/maxSize
  local sheet=Image(256,64,ColorMode.RGB)
  sheet:clear()
  rows[index]={}
  for f=0,3 do
    local b=boxes[f+1]
    local w,h=math.floor((b.x1-b.x0+1)*scale+0.5),math.floor((b.y1-b.y0+1)*scale+0.5)
    local dx,dy=math.floor((64-w)/2),math.floor((64-h)/2)
    local img=Image(64,64,ColorMode.RGB)
    img:clear()
    for y=0,h-1 do
      for x=0,w-1 do
        local pixel=src:getPixel(math.min(b.x1,b.x0+math.floor(x/scale)),math.min(b.y1,b.y0+math.floor(y/scale)))
        img:drawPixel(dx+x,dy+y,pixel)
        sheet:drawPixel(f*64+dx+x,dy+y,pixel)
        atlas:drawPixel(f*64+dx+x,(index-1)*64+dy+y,pixel)
      end
    end
    rows[index][f+1]=img
  end
  sheet:saveAs("assets/poing-"..letter:lower().."-shine-sheet.png")
end
-- 24 preview steps: same four drawings, smooth 2px floating over a two-second loop.
for step=0,23 do
  if step>0 then preview:newEmptyFrame() end
  local canvas=Image(320,72,ColorMode.RGB)
  canvas:clear()
  local frame=math.floor(step/6)+1
  for index=1,5 do
    local offset=math.floor(2*math.sin(step/24*math.pi*2+(index-1)*0.45)+0.5)
    canvas:drawImage(rows[index][frame],Point((index-1)*64,4+offset))
  end
  preview:newCel(preview.layers[1],step+1,canvas,Point(0,0))
  preview.frames[step+1].duration=0.08
end
atlas:saveAs("assets/poing-shine-atlas.png")
preview:saveAs("resources/poing-items/animation/preview.aseprite")
print("Saved five 256x64 sheets, 256x320 atlas and animated preview")
