-- Packs ImageGen art without procedurally drawing any character poses.
local root='resources/cat-bubble'
local function bounds(img,x0,x1)
  local b={x0=x1,y0=img.height,x1=x0,y1=0}
  for y=0,img.height-1 do for x=x0,x1 do
    if app.pixelColor.rgbaA(img:getPixel(x,y))>128 then
      b.x0=math.min(b.x0,x);b.y0=math.min(b.y0,y)
      b.x1=math.max(b.x1,x);b.y1=math.max(b.y1,y)
    end
  end end
  return b
end
local function headWidth(img,b)
  local left,right=img.width,0
  for y=b.y0,math.floor(b.y0+(b.y1-b.y0)*0.45) do
    for x=b.x0,b.x1 do
      local p=img:getPixel(x,y)
      local r,g,bl=app.pixelColor.rgbaR(p),app.pixelColor.rgbaG(p),app.pixelColor.rgbaB(p)
      if app.pixelColor.rgbaA(p)>128 and r>110 and r>g*1.1 and g>bl*1.2 then
        left=math.min(left,x);right=math.max(right,x)
      end
    end
  end
  assert(right>left,'Could not measure orange head')
  return right-left+1
end
local ref=Image{fromFile='assets/cat_jumpready.png'}
local head=headWidth(ref,bounds(ref,0,127))
local preview=Sprite(128,128,ColorMode.RGB)
local index=0
for _,entry in ipairs({{'jumpready',3},{'jumping',4}}) do
  local name,count=entry[1],entry[2]
  local src=Image{fromFile=root..'/'..name..'-source-v1.png'}
  local boxes={}
  for f=0,count-1 do boxes[f+1]=bounds(src,math.floor(f*src.width/count),math.floor((f+1)*src.width/count)-1) end
  -- One scale for each sequence, calibrated to original head width, not pose height.
  local scale=head/headWidth(src,boxes[1])
  local sheet=Image(count*128,128,ColorMode.RGB);sheet:clear()
  for f=0,count-1 do
    local b=boxes[f+1]
    local w=math.floor((b.x1-b.x0+1)*scale+0.5)
    local h=math.floor((b.y1-b.y0+1)*scale+0.5)
    assert(w<=124 and h<=112,'Sprite exceeds frame; inspect source')
    local img=Image(128,128,ColorMode.RGB);img:clear()
    local dx=math.floor((128-w)/2);local dy=112-h
    for y=0,h-1 do for x=0,w-1 do
      img:drawPixel(dx+x,dy+y,src:getPixel(math.min(b.x1,b.x0+math.floor(x/scale)),math.min(b.y1,b.y0+math.floor(y/scale))))
    end end
    sheet:drawImage(img,Point(f*128,0))
    index=index+1
    if index>1 then preview:newEmptyFrame() end
    preview:newCel(preview.layers[1],index,img,Point(0,0))
    preview.frames[index].duration=(name=='jumpready') and 0.3 or 0.16
    print(name..' '..f..': '..w..'x'..h..', headScale='..scale)
  end
  sheet:saveAs(root..'/'..name..'-sheet-v1.png')
end
local t=preview:newTag(1,3);t.name='jump-ready'
t=preview:newTag(4,7);t.name='jump'
preview:saveAs(root..'/jump-motion-v1.aseprite')
preview:saveAs(root..'/jump-preview-v1.gif')
