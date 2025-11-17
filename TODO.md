# TODOs

* Add an OpenTofu lint checker to ensure all OpenTofu files have a newline at the end. This is needed to ensure dependencies can be built.

# Test Plan

* Tested RegisterDevice (called at App load)
  * Confirm a record is added to Devices table
  * Confirm a subscription record is added in Amazon SNS
* Tested RegisterUser (called at Sign In With Apple)
  * Confirm a record is added to the Users table
  * Confirm a recrod is added to the UserDevices table
* Tested UserSubscribe (called at Sign In With Apple)
* Confirm a record is added to the Users table
* Tested ListFiles
* Tested StartFileUpload
  * Record is added to Files with PendingMetadata
  * Record is added to UserFiles with a link to the File
