#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# TODO: Make sure the local environment is running
# sam local start-lambda --debug
# docker run -p 8083:8083 --env-file aws-stepfunctions-local-credentials.txt amazon/aws-stepfunctions-local

my_state_machine_json=`cat aws-stepfunctions-state-machine-definition.json | jq -c`
echo "Creating local state machine"
my_state_machine_create_response=`aws stepfunctions --endpoint http://localhost:8083 create-state-machine --name "MyStateMachine" --role-arn "arn:aws:iam::012345678901:role/DummyRole" --definition "$my_state_machine_json"`
my_state_machine_arn=`echo $my_state_machine_create_response | jq -r '.stateMachineArn'`
echo "Local AWS state machine ARN: ${my_state_machine_arn}"
my_execution_name=`mktemp -u XXXXXXXXX`
my_execution_input=`cat "${bin_dir}/../swagger/start-download.json" | jq -c`
echo "Executing local state machine"
my_state_machine_execution_response=`aws stepfunctions --endpoint http://localhost:8083 start-execution --state-machine $my_state_machine_arn --name $my_execution_name --input "$my_execution_input"`
my_state_machine_execution_arn=`echo $my_state_machine_execution_response | jq -r '.executionArn'`
echo "Local AWS state machine execution ARN: ${my_state_machine_execution_arn}"
echo "Command for execution status has been copied to your clipboard"
echo "aws stepfunctions --endpoint http://localhost:8083 describe-execution --execution-arn $my_state_machine_execution_arn" | pbcopy
