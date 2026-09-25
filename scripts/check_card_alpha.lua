local im=Image{fromFile=app.params['source']}
print('size '..im.width..' '..im.height)
for _,pos in ipairs({{0,0},{20,768},{40,768},{60,768},{100,768},{512,10},{512,30},{512,50},{512,1480},{512,1510},{100,100},{20,200}}) do
local p=im:getPixel(pos[1],pos[2]); print(pos[1]..','..pos[2]..': '..app.pixelColor.rgbaR(p)..','..app.pixelColor.rgbaG(p)..','..app.pixelColor.rgbaB(p)..','..app.pixelColor.rgbaA(p))
end
