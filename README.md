# dixcord-bot
 Discord Bot for the Dixon Cox Butte Preservation Society discord

 This isn't super complex or really even that good, it's just a pet project to make our group chat more interesting and fun.
 
## COMMANDS:

#### Message responses: If the key is detected in a message, a response will be sent

- the phrase "take a look at this" triggers the bot to respond with an appropriate image
- posting a twitter/x.com link in a message that includes the text 'dd' 'dixbox' or 'fix' will prompt the bot to reply with a vxtwitter version of the same link. this is useful because twitter links look like dogshit when they unfurl.
- tagging the bot and asking a question will trigger the bot to reply with a (currently: randomly selected) good/bad/neutral response. 
- the bot collects sanitized chatlogs from whatever channels it is in. maybe someday this will be useful, possibly to train an LLM on conversational style?
- the bot also tracks the frequency of use of all server emojis and reactions in channels it can see. this is stored in a mysql database and currently is not retrievable thru the bot. the purpose of this is to track unused emojis so popular ones are not deleted when new emojis are cycled into the server list.
