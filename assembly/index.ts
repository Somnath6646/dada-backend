import { JSON } from "json-as"
import { dgraph } from "@hypermode/modus-sdk-as"
import { Content } from "./classes"
import { embedText } from "./embeddings"
import { buildContentMutationJson } from "./content-helpers"
import { deleteNodePredicates, ListOf, searchBySimilarity, getEntityById, addEmbeddingToJson, getAllContents, searchByTags } from "./dgraph-utils"

const DGRAPH_CONNECTION = "dgraph-grpc"

export function addContent(content: Content): Map<string, string> | null {
  var payload = buildContentMutationJson(DGRAPH_CONNECTION, content);

  const embedding = embedText([content.title])[0];
  payload = addEmbeddingToJson(payload, "Content.embedding", embedding);

  const mutations: dgraph.Mutation[] = [new dgraph.Mutation(payload)];
  const uids = dgraph.execute(DGRAPH_CONNECTION, new dgraph.Request(null, mutations)).Uids;

  return uids;
}

export function getContent(id: string): Content | null {
  const body = `
    Content.id
    Content.title
    Content.url
    Content.type`
  return getEntityById<Content>(DGRAPH_CONNECTION, "Content.id", id, body);
}


export function deleteContent(id: string): void {
  deleteNodePredicates(DGRAPH_CONNECTION, `eq(Content.id, "${id}")`, 
    ["Content.id", "Content.title", "Content.url", "Content.type"]);
}


export function searchContent(query: string, contentType: string = ""): Content[] {
  const embedding = embedText([query])[0];
  const topK = 10;
  
  let typeFilter = "";
  if (contentType != "") {
    typeFilter = ` @filter(eq(Content.type, "${contentType}"))`;
  }
  
  const body = `
    Content.id
    Content.title
    Content.url
    Content.type
  `
  return searchBySimilarity<Content>(DGRAPH_CONNECTION, embedding, "Content.embedding", body, topK);
}


export function getContentByType(type: string): Content[] {
  const query = new dgraph.Query(`{
    list(func: eq(Content.type, "${type}")) {
      Content.id
      Content.title
      Content.url
      Content.type
    }
  }`);
  
  const response = dgraph.execute(DGRAPH_CONNECTION, new dgraph.Request(query));
  const data = JSON.parse<ListOf<Content>>(response.Json);
  return data.list;
}

export function getAllContent(): Content[] {
  const body = `
    Content.id
    Content.title
    Content.url
    Content.type
    Content.tags`
  return getAllContents<Content>(DGRAPH_CONNECTION, body);
}

export function getAllTags(): string[] {
  const query = new dgraph.Query(`{
    list(func: type(Content)) @filter(has(Content.tags)) {
      Content.tags
    }
  }`);
  
  const response = dgraph.execute(DGRAPH_CONNECTION, new dgraph.Request(query));
  const data = JSON.parse<ListOf<Content>>(response.Json);
  
  // Create a unique set of tags
  const uniqueTags = new Set<string>();
  for (let i = 0; i < data.list.length; i++) {
    const content = data.list[i];
    if (content.tags) {
      for (let j = 0; j < content.tags.length; j++) {
        uniqueTags.add(content.tags[j]);
      }
    }
  }
  
  // Convert set to array
  const tags: string[] = [];
  const values = uniqueTags.values();
  for (let i = 0; i < uniqueTags.size; i++) {
    tags.push(values[i]);
  }
  return tags;
}

export function getContentByTags(tags: string[]): Content[] {
  const body = `
    Content.id
    Content.title
    Content.url
    Content.type
    Content.tags`;
  return searchByTags<Content>(DGRAPH_CONNECTION, tags, body);
}

export function getContentByTag(tag: string): Content[] {
  const query = new dgraph.Query(`{
    list(func: type(Content)) @filter(has(Content.tags) AND anyofterms(Content.tags, "${tag}")) {
      Content.id
      Content.title
      Content.url
      Content.type
      Content.tags
      Content.embedding
    }
  }`);
  
  const response = dgraph.execute(DGRAPH_CONNECTION, new dgraph.Request(query));
  const data = JSON.parse<ListOf<Content>>(response.Json);
  return data.list;
}



