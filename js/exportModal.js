var exportModal = {

    show: function () {

        $('#export-overlay').removeClass('hidden')
        exportModal.reset()
        $('#export-model-path').focus()

    },

    hide: function () {

        $('#export-overlay').addClass('hidden')
        exportModal.reset()

    },

    reset: function () {

        var framesCount = $('.timeline-frame-element').length

        if (framesCount > 0)
        {
            $('#export-modal-main').removeClass('hidden')
            $('#export-modal-export').removeClass('hidden')
            $('#export-nothing').addClass('hidden')
            $('#export-model-path').val('example:mob/herobrine/walking')
            $('#export-texture-path').val('example:mob/herobrine/walking')
        }
        else
        {
            $('#export-modal-main').addClass('hidden')
            $('#export-modal-export').addClass('hidden')
            $('#export-nothing').removeClass('hidden')
        }
    },

    export: function (modelPath, texturePath, packFormat) {

        console.log('export')

        modelPath = modelPath.trim()
        texturePath = texturePath.trim()

        var modelPath_splitted = modelPath.split(":")
        var texturePath_splitted = texturePath.split(":")
        var tmp = modelPath;
        var namespace = "minecraft";

        if (modelPath_splitted.length == 2)
        {
            tmp = modelPath_splitted[1];
            namespace = modelPath_splitted[0];
            modelPath = modelPath_splitted[1];
        }

        if (texturePath_splitted.length == 2)
        {
            texturePath = texturePath_splitted[1];
        }

        tmp = tmp.split('/')
        var modelName = tmp[tmp.length - 1]

        tmp = texturePath.split('/')
        var textureName = tmp[tmp.length - 1]

        var animation = getAnimation(animationFrames)

        var files = createFiles(animationFrames, animation, modelName, textureName, modelPath, texturePath, namespace)

        var zip = new JSZip()

        zip.file('pack.mcmeta', '{\n    "pack": {\n        "pack_format": ' + (packFormat * 1) + ',\n        "description": "Generated by Fizzy\'s Json model animator"\n    }\n}\n')

        zip.file('assets/' + namespace + '/models/' + modelPath + '.json', files.model)
        zip.file('assets/' + namespace + '/textures/' + texturePath + '.png', files.texture, {base64: true})
        zip.file('assets/' + namespace + '/textures/' + texturePath + '.png.mcmeta', files.mcmeta)

        zip.generateAsync({type: 'blob'})
            .then(function (blob) {
                saveAs(blob, 'Animated model - ' + textureName.charAt(0).toUpperCase() + textureName.substr(1) + '.zip')
            })

    }

}


function getAnimation(animationFrames)
{

    var animation = []

    $('.timeline-frame-element').each(function () {

        var frame = $(this)

        var name = frame.attr('data-name')
        var duration = frame.attr('data-duration')

        animation.push({name: name, duration: duration})

    })

    return animation

}


function createFiles(animationFrames, animation, modelName, textureName, modelPath, texturePath, namespace)
{

    var frameNames = Object.keys(animationFrames)

    var requiredFrames = {}

    for (var i = 0; i < animation.length; i++)
    {
        var frame = animation[i]
        requiredFrames[frame.name] = animationFrames[frame.name]
    }

    var requiredFrameNames = Object.keys(requiredFrames)

    var textureMaxHeight = 0
    var textureTotalWidth = 0

    for (var i = 0; i < requiredFrameNames.length; i++)
    {
        var name = requiredFrameNames[i]
        var frame = requiredFrames[name]
        if (frame.textureSize > textureMaxHeight) textureMaxHeight = frame.textureSize
        textureTotalWidth += frame.textureSize
    }

    var textureTotalPixels = textureTotalWidth * textureMaxHeight

    var animatedModel = $.extend(true, {}, requiredFrames[requiredFrameNames[0]].model)

    animatedModel.__comment = 'Model animated using Fizzy\'s model animator - http://fizzy81.github.io/animated-models/'
    animatedModel.textures = {main: namespace + ":" + texturePath}

    var textureSize = 16

    while (Math.pow(textureSize, 2) < textureTotalPixels)
    {
        textureSize *= 2
    }

    var canvas = document.createElement('canvas')
    canvas.setAttribute('width', textureSize)
    canvas.setAttribute('height', textureSize * requiredFrameNames.length)

    var context = canvas.getContext('2d')

    animatedModel.elements = []

    var offsetX = 0
    var offsetY = 0
    var rowHeight = 0

    for (var i = 0; i < requiredFrameNames.length; i++)
    {

        var currentFrame = requiredFrames[requiredFrameNames[i]]
        var currentModel = currentFrame.model
        var currentTexture = currentFrame.texture

        context.drawImage(currentTexture, offsetX, offsetY + textureSize * i)

        for (var j = 0; j < currentModel.elements.length; j++)
        {

            var element = currentModel.elements[j]
            var faces = element.faces

            var sides = Object.keys(faces)

            for (var k = 0; k < sides.length; k++)
            {

                var side = sides[k]
                var face = faces[side]

                face.uv[0] = (face.uv[0] * (currentTexture.width / 16) + offsetX) / (textureSize / 16)
                face.uv[2] = (face.uv[2] * (currentTexture.width / 16) + offsetX) / (textureSize / 16)

                face.uv[1] = (face.uv[1] * (currentTexture.height / 16) + offsetY) / (textureSize / 16)
                face.uv[3] = (face.uv[3] * (currentTexture.height / 16) + offsetY) / (textureSize / 16)

                face.texture = '#main'

            }

            animatedModel.elements.push(element)

        }

        if (rowHeight < currentTexture.height)
        {
            rowHeight = currentTexture.height
        }

        offsetX += currentTexture.width
        if (offsetX >= textureSize)
        {
            offsetY += rowHeight
            offsetX = 0
            rowHeight = 0
        }

    }

    var mcmeta = {
        animation: {
            frames: []
        }
    }

    for (var i = 0; i < animation.length; i++)
    {
        var frame = animation[i]
        mcmeta.animation.frames.push({
            index: requiredFrameNames.indexOf(frame.name),
            time: frame.duration * 1
        })
    }

    return {
        model: stringifyModel(animatedModel),
        texture: canvas.toDataURL('image/png').substr(22),
        mcmeta: stringifyMcmeta(mcmeta)
    }

}


function stringifyModel(model)
{

    return JSON.stringify(model, cleanJson, 4).replace(/\\"/g, '"').replace(/,/g, ', ').replace(/\}clean"/g, ' }').replace(/"clean\{/g, '{ ').replace(/\]clean"/g, ' ]').replace(/"clean\[/g, '[ ').replace(/"\:"/g, '": "').replace(/"\:\[/g, '": [').replace(/"east":/g, '"east": ').replace(/"west":/g, '"west": ').replace(/"down":/g, '"down": ').replace(/"up":/g, '"up":   ').replace(/"to":/g, '"to":  ').replace(/"angle":/g, '"angle": ')

}


function stringifyMcmeta(mcmeta)
{

    return JSON.stringify(mcmeta).replace(/\"animation\":/g, '\n    "animation": ').replace(/\"frames\":/g, '\n        "frames": ').replace(/\{\"index":/g, '\n            {"index": ').replace(/\"time\":/g, ' "time": ').replace(/\]\}\}/g, '\n        ]\n    }\n}');

}


function cleanJson(key, value)
{
    var special = ['from', 'to', 'north', 'east', 'south', 'west', 'up', 'down', 'rotation', 'translation', 'scale', 'predicate', 'model'];
    if (special.indexOf(key) >= 0)
    {
        return 'clean' + JSON.stringify(value, function (key, value) {
            if (key == 'uv')
            {
                return 'clean' + JSON.stringify(value) + 'clean'
            }
            return value
        }) + 'clean';
    }
    else
    {
        return value;
    }
}
