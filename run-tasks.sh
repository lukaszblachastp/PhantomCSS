#!/bin/bash
rm -rf ./img

# runn all tests asynchronously
for file in `ls tasks`; do
	task="${file%.*}"
	./node_modules/casperjs/bin/casperjs test ./suiterunner.js --task=$task &
done

# wait for all tests to finish
failcount=0
for job in `jobs -p`; do
	wait $job || let "failcount+=1"
done

# echo "DONE. $failcount tests failed"
