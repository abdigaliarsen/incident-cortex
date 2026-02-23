![Thumbnail (1920x1080)](https://i.ytimg.com/vi/6cv7JVvuJb8/maxresdefault.jpg)
# [Introducing Elastic Agent Builder: The best context and tools for your agents](https://www.youtube.com/watch?v=6cv7JVvuJb8)

**Visibility**: Public
**Uploaded by**: [Official Elastic Community](http://www.youtube.com/@OfficialElasticCommunity)
**Uploaded at**: 2025-10-21T08:19:19-07:00
**Published at**: 2025-10-21T08:19:19-07:00
**Length**: 04:03
**Views**: 3454
**Likes**: 66
**Category**: Science & Technology

## Description

```
Exciting news: Elastic Agent Builder is here! 
Build native agents within the Elastic Stack, with RAG powered by Elastic's top-of-the- line retrieval and relevance. Integrate your AI agents with your existing indexes, build tools out of ES|QL queries, and deploy your favorite LLMs on the Elastic Inference Server. 
Join our senior Developer Advocate Iulia Feroli, as she introduces Elastic Agent Builder and creates a custom agent.
Check out Elastic's take on chat, and start talking with your data today! 

00:00 Introducing Elastic Agent Builder
00:21 Vector Database, Relevance, Retrieval
00:30 Data Privacy
00:38 Native Integrations
01:00 Demo of Agent Builder
01:10 Native Elastic Tools
01:23 Build a Custom Agent
01:45 Customised Experience
01:55 Tool Registry Demo
02:12 Defina a Custom Tool
02:45 Automatic Tool Calling
02:54 MCP Server Demo
03:03 Integrate with external clients
03:16 Add to a custom App
03:48 What’s next?

Read more about the launch: https://www.elastic.co/search-labs/blog/elastic-ai-agent-builder-context-engineering-introduction
Check out the new docs: https://www.elastic.co/docs/solutions/search/elastic-agent-builder 
Get started today with a Cloud trial: https://cloud.elastic.co/registration

#AgentBuilder #ContextEngineering #Elasticsearch #MCPserver #AgentTools
```

## Transcript

Some exciting news. Elastic is joining the chat space and it makes a lot of sense. Sure, there's a lot of LLM providers out there and they're all kind of building their own agentic experience. How do you choose? Well, if you think about why specifically you want to use an agent, most of the time it's to interact with your data. So, it makes a lot of sense to have a native experience where your data already lives. If you use the elastic agent builder, you can leverage the vector database and the retrieval and relevance and awesome search experience that elastic is known for. So, not only that, we're not sending your data out there, you're not giving access to your private information to thirdparty providers and tooling. You can have everything on top of architecture that you already know and love. And you can also choose whichever LLM you want to power this experience and host it within the elastic inference server. So you're bringing natural language and the ability to have a gentic rag pretty much out of the box on top of your elastic stack and the most important part is that it's very very easy to set up. So let's take a look at how it works. The agent builder allows you to jump right into talking to your data. So already the default assistant comes preloaded with elastic specific tooling for you to use from knowing the indexes on the cluster and understanding mappings to being able to create queries from simple natural language. The agent will choose the appropriate tools within conversations. So you don't have to define when to use what. But let's make a custom experience. In a few clicks, you can define a custom agent and you can give the LLM specific prompts to define the way that they're going to behave from their goal and their reasoning model to even the way they format their responses. And finally, for each agent, we can assign specific tools based on the domain. And we can see how we build those tools as well in a second. So now we have a specialized agent that we're able to switch to and have the experience that we need for this task. You can already see how the response is now customized to what we selected. So now let's make some tools. What makes an agent effective is its range of tools. Now while the elastic agent already comes preloaded with elastic specific tools like being able to do searches, index listing, and autogenerating queries from natural language, you'll often need something that is a little bit more use case specific. So let's define a custom tool. All you need is a name and a description and of course the main tool definition. And here you can put in a custom query. Basically writing an ESQL command for a recurring task that you want to automate. You can test it out within the dev tools first and even directly register it from here or with another API call from whatever language client you're used to working with. Or of course you can keep everything in the Kibana UI. However you choose to register the tool, it will then show up in the tool registry and you're able to assign it from here to whichever agent fits best. So from here in all further conversations, the agent will choose to call out a tool when it thinks it's appropriate. So you don't have to specifically call it out. It's simple and seamless. And we can take our agents even further. With the MCP server, you're able to integrate them into other existing applications or bring in external tooling. Simply add your MCP URL to an agent of your choice. in this example, Claude, and then all the awesome elastic optimized functionalities and tooling will become available in a familiar setting. You can just call them out from the chat. Or you can build your own custom app to work as the client and integrate everything the same way. Just add in the MCB server URL and you can make all the default and custom tools available to use within this app. The tools will work behind the scenes, but you can integrate them as having it either be a callable action or building out a chat experience in the new UI and have them call out from there. So, you've built out all the logic in Elastic, but the MCP server allows you to export this and have a unified experience in whatever client you choose to talk to your data from. And that's just scratching the surface. There's a lot of really cool features and tools with the Elastic Agent Builder. So, why not try it out today? You can sign up for a free trial and launch it in the description below or you can learn more about it in our documentation.


