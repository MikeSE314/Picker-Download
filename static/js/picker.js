

const showQRCode = () => {
  const response = fetch("/get_session", {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    json: true
  }).then((response) => response.json())
  .then((responseData) => {

    if(responseData["error"]) {
      console.log("ERROR: ", responseData)
      // The cloud project may not be in the correct group
      window.location = "/cloud_error"
    }
    if(responseData["auth-error"]) {
      window.location = "/disconnect"
    }

    if(responseData.mediaItemsSet) {
      // If there are media items set then the picking session is over
      // forward to the list page to see those items
      window.location = "/list"
    } else {
      new QRCode(document.getElementById("qrcode"), responseData.pickerUri);

      $("#picker_url").attr("href", responseData.pickerUri)
      $('#picker_url').show()
    }
  })
}



const fetchImages = async (pageToken) => {

  let pageTokenQuery = ""
  if(pageToken) {
    pageTokenQuery = "?pageToken="+pageToken
  }

  const response = await fetch("/fetch_images"+pageTokenQuery, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    json: true
  })

  const json = await response.json()
  return json

}

const loadImageIntoImg = (imgId, baseUrl) => {
  const response = fetch("/image", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    json: true,
    body: JSON.stringify({
      "baseUrl": baseUrl
    })
   }).then(res => {
     res.blob().then(blob => {
       document.getElementById(imgId).src = URL.createObjectURL(blob)
       $("#largeImg").show()
     })
   })
}

const loadImageIntoVideo = (videoId, baseUrl) => {
  $("#downloadVideo").show()
  const response = fetch("/video", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    json: true,
    body: JSON.stringify({
      "baseUrl": baseUrl
    })
   }).then(res => {
     res.blob().then(blob => {
       document.getElementById(videoId).src = URL.createObjectURL(blob)
       $("#largeVideo").show()
       $("#downloadVideo").hide()
     })
   })
}

