"""Create a lookup-mode copy of ic-deployments for ES|QL LOOKUP JOIN.

ES|QL LOOKUP JOIN requires the right-side index to use index.mode=lookup
(single shard). This script copies data from ic-deployments into
ic-deployments-lookup with the correct index mode.
"""

import os
from elasticsearch import Elasticsearch, helpers

es = Elasticsearch(
    os.environ["ELASTICSEARCH_URL"],
    api_key=os.environ["API_KEY"],
)

LOOKUP_INDEX = "ic-deployments-lookup"
SOURCE_INDEX = "ic-deployments"

# Delete if exists
if es.indices.exists(index=LOOKUP_INDEX):
    es.indices.delete(index=LOOKUP_INDEX)
    print(f"Deleted existing {LOOKUP_INDEX}")

# Create with lookup mode (single shard, required for LOOKUP JOIN)
es.indices.create(
    index=LOOKUP_INDEX,
    body={
        "settings": {
            "index.mode": "lookup",
        },
        "mappings": {
            "properties": {
                "@timestamp": {"type": "date"},
                "deployment_service": {"type": "keyword"},
                "deployment.version": {"type": "keyword"},
                "deployment.service": {"type": "keyword"},
                "deployment.author": {"type": "keyword"},
                "deployment.status": {"type": "keyword"},
                "deployment.commit_sha": {"type": "keyword"},
                "deployment.changes": {"type": "text"},
            }
        },
    },
)
print(f"Created {LOOKUP_INDEX} with index.mode=lookup")

# Copy data from ic-deployments, adding deployment_service field for JOIN key
docs = []
for hit in helpers.scan(es, index=SOURCE_INDEX):
    src = hit["_source"]
    src["deployment_service"] = src.get("deployment.service", "")
    docs.append({"_index": LOOKUP_INDEX, "_source": src})

if docs:
    indexed, errors = helpers.bulk(es, docs, refresh="wait_for")
    print(f"Copied {indexed} documents to {LOOKUP_INDEX}")
else:
    print("No documents found in ic-deployments to copy")
