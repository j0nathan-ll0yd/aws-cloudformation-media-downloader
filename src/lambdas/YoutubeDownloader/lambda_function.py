import os
import json
import yt_dlp
import random

# Split dependencies based on the architecture type; then switch for local development
# https://www.reddit.com/r/learnpython/comments/152udwe/custom_directory_for_python_dependencies/

def get_headers():
  return [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/37.0.2062.94 Chrome/37.0.2062.94 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko',
  'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/600.8.9 (KHTML, like Gecko) Version/8.0.8 Safari/600.8.9',
  'Mozilla/5.0 (iPad; CPU OS 8_4_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12H321 Safari/600.1.4',
  'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10240',
  'Mozilla/5.0 (Windows NT 6.3; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0',
  'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko',
  'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko'
  ]

def get_random_header():
    random_header = random.choice(get_headers())
    refactored_header = random_header[:len(random_header)-1]
    header_dict = {"User-Agent": str(refactored_header)}
    return header_dict

# To add dependencies: https://docs.aws.amazon.com/lambda/latest/dg/python-package.html#python-package-native-libraries
def lambda_handler(event, context):
    print('## ENVIRONMENT VARIABLES')
    print(os.environ['AWS_LAMBDA_LOG_GROUP_NAME'])
    print(os.environ['AWS_LAMBDA_LOG_STREAM_NAME'])
    print('## EVENT')
    print(event)
    json_region = os.environ['AWS_REGION']

    # Proxy from: https://proxyscrape.com/free-proxy-list
    options = {
      "quiet": False,
      "no_warnings": False
      "allow_unplayable_formats": False,
      "format": "bestvideo*+bestaudio/best",
      "proxy": "http://130.36.47.108:80/",
      "add_header": get_random_header()
    }
    print(options)

    ytdl = yt_dlp.YoutubeDL(options)
    uri = "https://www.youtube.com/watch?v=7E-cwdnsiow"
    print(uri)
    info = ytdl.extract_info(uri, download=False, force_generic_extractor=False)
    print(json.dumps(ydl.sanitize_info(info)))
