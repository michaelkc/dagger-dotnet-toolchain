must run in /build ...

$env:GH_PAT="ghp_x5q7..."
dagger call dagger-dotnet-toolchain-debug dotnet-restore --progress=plain --githubFeedToken=GH_PAT
dagger call dagger-dotnet-toolchain-debug dotnet-publish --progress=plain --githubFeedToken=GH_PAT --publish-config=./dotnet_packages_to_publish.json  -o ../artifacts