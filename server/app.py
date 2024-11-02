from elasticsearch import Elasticsearch
import pandas as pd
import numpy as np
from flask import Flask, jsonify, request
import os
from dotenv import load_dotenv
from flask_cors import CORS, cross_origin


app = Flask(__name__)
load_dotenv()
es = Elasticsearch(os.getenv("ES_LOCAL_URL"), api_key=os.getenv("ES_LOCAL_API_KEY"))


def create_index():
    mapping = {
        "mappings": {
            "properties": {
                "id": {"type": "integer"},
                "name": {"type": "text"},
                "price": {"type": "float"},
                "is_discontinued": {"type": "boolean"},
                "manufacturer_name": {"type": "text"},
                "type": {"type": "keyword"},
                "pack_size_label": {"type": "text"},
                "short_composition1": {"type": "text"},
                "short_composition2": {"type": "text"},
            }
        }
    }

    if not es.indices.exists(index="medicines"):
        es.indices.create(index="medicines", body=mapping)


@app.route("/")
@cross_origin(origin="*")
def index():
    return jsonify({"message": "Hello, World!"}), 200


@app.route("/load-medicines", methods=["GET"])
@cross_origin(origin="*")
def load_medicines():
    try:
        create_index()
        df = pd.read_csv("data/A_Z_medicines_dataset_of_India.csv")
        df = df.replace({np.nan: None})
        for _, row in df.iterrows():
            doc = {
                "id": int(row["id"]),
                "name": row["name"],
                "price": float(row["price(₹)"]),
                "is_discontinued": bool(row["Is_discontinued"]),
                "manufacturer_name": row["manufacturer_name"],
                "type": row["type"],
                "pack_size_label": row["pack_size_label"],
                "short_composition1": row["short_composition1"],
                "short_composition2": (
                    row["short_composition2"]
                    if pd.notna(row["short_composition2"])
                    else None
                ),
            }
            doc = {k: v for k, v in doc.items() if v is not None}
            try:
                es.index(index="medicines", id=doc["id"], document=doc)
            except Exception as e:
                print(f"Error indexing document {doc['id']}: {str(e)}")
                print(f"Document content: {doc}")
                continue

        return jsonify({"message": "Data loaded successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/fetchMedicine", methods=["GET"])
@cross_origin(origin="*")
def fetch_medicine():
    try:
        medicine_name = request.args.get("name", "")
        if not medicine_name:
            return (
                jsonify(
                    {
                        "error": "Medicine name is required",
                        "message": "Please provide a medicine name using the 'name' query parameter",
                    }
                ),
                400,
            )
        query_body = {
            "query": {
                "bool": {
                    "should": [
                        {
                            "match_phrase": {
                                "name": {"query": medicine_name, "boost": 3}
                            }
                        },
                        {
                            "match": {
                                "name": {
                                    "query": medicine_name,
                                    "fuzziness": "AUTO",
                                    "boost": 2,
                                }
                            }
                        },
                        {
                            "prefix": {
                                "name": {"value": medicine_name.lower(), "boost": 1}
                            }
                        },
                    ],
                    "minimum_should_match": 1,
                }
            },
            "sort": ["_score"],
            "size": 10,
        }

        result = es.search(index="medicines", body=query_body)
        medicines = []
        for hit in result["hits"]["hits"]:
            medicine = hit["_source"]
            medicine["score"] = hit["_score"]
            medicines.append(medicine)

        response = {
            "total": result["hits"]["total"]["value"],
            "medicines": medicines,
            "query": medicine_name,
        }

        if not medicines:
            suggest_query = {
                "suggest": {
                    "medicine-suggest": {
                        "text": medicine_name,
                        "term": {
                            "field": "name",
                            "suggest_mode": "popular",
                            "sort": "frequency",
                            "min_word_length": 3,
                        },
                    }
                }
            }

            suggest_result = es.search(index="medicines", body=suggest_query)
            suggestions = []

            if "suggest" in suggest_result:
                for suggestion in suggest_result["suggest"]["medicine-suggest"]:
                    for option in suggestion["options"]:
                        suggestions.append(option["text"])
            if suggestions:
                response["suggestions"] = list(set(suggestions))
        return jsonify(response), 200

    except Exception as e:
        return jsonify({"error": "Search failed", "message": str(e)}), 500


@app.route("/suggestions", methods=["GET"])
@cross_origin(origin="*")
def get_suggestions():
    try:
        prefix = request.args.get("prefix", "")
        if not prefix or len(prefix) < 2:
            return jsonify({"suggestions": []}), 200

        query_body = {
            "query": {
                "bool": {
                    "should": [
                        {"prefix": {"name": {"value": prefix.lower(), "boost": 2}}},
                        {"match": {"name": {"query": prefix, "fuzziness": "AUTO"}}},
                    ]
                }
            },
            "_source": ["name"],
            "size": 5,
        }

        result = es.search(index="medicines", body=query_body)
        suggestions = [hit["_source"]["name"] for hit in result["hits"]["hits"]]

        return jsonify({"suggestions": suggestions}), 200

    except Exception as e:
        return jsonify({"error": "Suggestions failed", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
