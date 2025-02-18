import logging
logger = logging.getLogger(__name__)

FFMPEG_STATIC = "/var/task/ffmpeg"
if logging.getLogger().hasHandlers():
  # required for the Lambda context
  logging.getLogger().setLevel(logging.DEBUG)

  ''' Used to ensure ffmpeg was installed; it is :)
  import subprocess
  result = subprocess.run([FFMPEG_STATIC, '-version'], capture_output=True, text=True)
  print("STDOUT:", result.stdout)
  print("STDERR:", result.stderr)
  '''
else:
  # required for the local context
  logging.basicConfig(level=logging.DEBUG)

import os
import time
import json
import sys

filepath = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, filepath + "/packages/local")
import requests
import yt_dlp


def get_static_formats():
  with open(filepath + "/fixtures/formats.json", "r") as file:
    formats = json.load(file)
    return formats

def lambda_handler(event, context):
  logger.info('## EVENT')
  logger.debug(event)
  logger.info('## CONTEXT')
  logger.debug(context)
  uri = event.get("uri")
  if uri is None:
    return {
      'statusCode': 400,
      'body': {"message": "uri is required"}
    }

  # get a proxy to use via Lambda
  proxy = get_proxy_list()

  options = {
    "quiet": False,
    "cachedir": "/tmp/", # won't work on AWS Lambda
    "no_warnings": False,
    "allow_unplayable_formats": False,
    "format": 'bestvideo*+bestaudio/best',
    "proxy": proxy,
    "ffmpeg_location": FFMPEG_STATIC,
    "prefer_ffmpeg": True,
    "rm_cache_dir": True,
  }
  logger.info('## YOUTUBEDL OPTIONS')
  logger.debug(json.dumps(options, sort_keys=True, indent=2))

  try:
    ytdl = yt_dlp.YoutubeDL(options)
    info = ytdl.extract_info(uri, download=False, force_generic_extractor=False)
  except Exception as e:
    logger.error('## ERROR')
    logger.error(e)
    return

  logger.info('## INFO')
  logger.info(info)
  formats = info.get("formats")
  # formats = get_static_formats()
  logger.info('## FORMATS')
  logger.info(json.dumps(formats))
  # the list is in ascending order of quality, so we reverse it to get the best quality first
  filtered_formats = list(filter(lambda x: x.get("ext") == "mp4" and x.get("protocol") == "https", formats[::-1]))
  best_format = filtered_formats[0]
  logger.info('## BEST_FORMAT')
  logger.info(json.dumps(best_format, sort_keys=True, indent=2))
  response_data = {
    "videoId": info.get("id"),
    "videoUrl": best_format.get("url"),
    "title": info.get("title"),
    "description": info.get("description"),
    "imageUri": info.get("thumbnail"),
    "published": info.get("timestamp"),
    "uploaderId": info.get("uploader_id"),
    "uploaderName": info.get("uploader"),
    "ext": best_format.get("ext"),
    "mimeType": "video/mp4",
  }
  logger.info('## RESPONSE')
  logger.info(json.dumps(response_data, sort_keys=True, indent=2))
  return {
    'statusCode': 200,
    'body': response_data
  }

def check_proxy(proxy):
  url = "https://httpbun.com/get"
  proxies = {
    "http": proxy,
    "https": proxy
  }
  try:
    logger.info('## CHECK PROXY')
    logger.debug(proxy)
    response = requests.get(url, proxies=proxies, timeout=5)
    logger.debug(json.dumps(dict(response.headers), sort_keys=True, indent=2))
    if response.status_code == 200:
      return True
    else:
      return False
  except requests.exceptions.RequestException as e:
    print(f"Proxy check failed: {e}")
    return False

def get_proxy_list():
  # Proxy from: https://proxyscrape.com/free-proxy-list
  url = "https://api.proxyscrape.com/v3/free-proxy-list/get"
  params = {
    "request": "displayproxies",
    "proxy_format": "protocolipport",
    "timeout": 5000,
    "country": "us",
    "ssl": "all",
    "anonymity": "all",
    "format": "text"
  }
  logger.info('## GET PROXY LIST')
  response = requests.get(url, params=params)
  logger.debug(json.dumps(dict(response.headers), sort_keys=True, indent=2))
  if response.status_code != 200:
    raise Exception("Failed to get proxy list")
  elif response.text == "":
    raise Exception("Empty response")
  elif response.content == 0:
    raise Exception("Empty content")

  proxies = response.text.split("\r\n")
  for proxy in proxies:
    if proxy.startswith("http") is False:
      continue

    if check_proxy(proxy):
      return proxy
    time.sleep(1)
  raise Exception("No proxies available")

# This call is ignored in production, but useful for local testing
lambda_handler({ "uri": "https://www.youtube.com/watch?v=4ZmGmryMKI4"}, {})
