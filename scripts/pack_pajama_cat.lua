-- Asset preparation only; all poses are ImageGen artwork.
local preview=Sprite(128,128,ColorMode.RGB)
local index=0
for _,entry in ipairs({{"jumpready",3},{"jumping",4}}) do
  local name,count=entry[1],entry[2]
  local src=Image{fromFile="resources/pajama-cat/"..name.."-source.png"}
  local boxes={}
  local maxW,maxH=0,0
  for f=0,count-1 do
    local l=math.floor(f*src.width/count)
    local r=math.floor((f+1)*src.width/count)-1
    local b={x1=r,y1=src.height-1,x2=l,y2=0}
    for y=0,src.height-1 do for x=l,r do
      if app.pixelColor.rgbaA(src:getPixel(x,y))>128 then
        b.x1=math.min(b.x1,x); b.x2=math.max(b.x2,x)
        b.y1=math.min(b.y1,y); b.y2=math.max(b.y2,y)
      end
    end end
    boxes[f+1]=b
    maxW=math.max(maxW,b.x2-b.x1+1)
    maxH=math.max(maxH,b.y2-b.y1+1)
  end
  local scale=math.min(110/maxW,110/maxH)
  local sheet=Image(128*count,128,ColorMode.RGB); sheet:clear()
  for f=0,count-1 do
    local b=boxes[f+1]
    local cx=(b.x1+b.x2)/2
    local img=Image(128,128,ColorMode.RGB); img:clear()
    for y=0,127 do for x=0,127 do
      local sx=math.floor(cx+(x-64)/scale)
      local sy=math.floor(b.y2+(y-115)/scale)
      if sx>=b.x1 and sx<=b.x2 and sy>=b.y1 and sy<=b.y2 then
        img:drawPixel(x,y,src:getPixel(sx,sy))
      end
    end end
    sheet:drawImage(img,Point(f*128,0))
    index=index+1
    if index>1 then preview:newEmptyFrame() end
    preview:newCel(preview.layers[1],index,img,Point(0,0))
    preview.frames[index].duration=0.18
  end
  sheet:saveAs("assets/cat-cloud-pajamas-"..name..".png")
end
preview:saveAs("resources/pajama-cat/jump-preview.aseprite")
