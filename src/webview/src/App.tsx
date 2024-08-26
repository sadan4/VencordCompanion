import './App.css';
import { ReporterSections } from './Reporter';  

// export const vscode = acquireVsCodeApi();

//@ts-ignore
window.reporterData = 
{
  "failedPatches": {
      "foundNoModule": [{
          "find": "id:\"premium\",",
          "replacement": [{
              "match": {},
              "replace": "$&$1.unshift(...$self.getBadges(arguments[0]));"
          }, {
              "match": {},
              "replace": "...$1.props,$& $1.image??"
          }, {
              "match": {},
              "replace": "children:$1.component ? () => $self.renderBadgeComponent($1) :"
          }, {
              "match": {},
              "replace": "...($1.onClick && { onClick: vcE => $1.onClick(vcE, $1) }),$&"
          }],
          "plugin": "BadgeAPI"
      }, {
          "find": ".USER_PROFILE}};return",
          "replacement": [{
              "match": {},
              "replace": "$&,$self.friendsSinceOld({ userId: $1 })"
          }],
          "plugin": "FriendsSince"
      }, {
          "find": ".PROFILE_PANEL,",
          "replacement": [{
              "match": {},
              "replace": "$&,$self.friendsSinceOld({ userId: $1 })"
          }],
          "plugin": "FriendsSince"
      }, {
          "find": ".userInfoSectionHeader,",
          "replacement": [{
              "match": {}
          }],
          "plugin": "FriendsSince"
      }, {
          "find": "copyMetaData:\"User Tag\"",
          "replacement": [{
              "match": {},
              "replace": ",moreTags_channelId:arguments[0].moreTags_channelId"
          }],
          "plugin": "MoreUserTags"
      }, {
          "find": ".Messages.MUTUAL_GUILDS_WITH_END_COUNT",
          "replacement": [{
              "match": {},
              "replace": "$self.isBotOrSelf(arguments[0].user)?null:$1\"MUTUAL_GDMS\",children:$self.getMutualGDMCountText(arguments[0].user)}),"
          }],
          "plugin": "MutualGroupDMs"
      }, {
          "find": ".USER_INFO_CONNECTIONS:case",
          "replacement": [{
              "match": {},
              "replace": "case \"MUTUAL_GDMS\":return $self.renderMutualGDMs({user: $1, onClose: $2});"
          }],
          "plugin": "MutualGroupDMs"
      }, {
          "find": ".avatarPositionPremiumNoBanner,default:",
          "replacement": [{
              "match": {},
              "replace": ".$1"
          }],
          "plugin": "NoProfileThemes"
      }, {
          "find": ".pronouns,children",
          "replacement": [{
              "match": {},
              "replace": "$&let vcPronounSource;[$2,vcPronounSource]=$self.useProfilePronouns($1.id);"
          }, {
              "match": {},
              "replace": "$& + (typeof vcPronounSource !== \"undefined\" ? ` (${vcPronounSource})` : \"\")"
          }],
          "plugin": "PronounDB"
      }, {
          "find": ".nameTagSmall)",
          "replacement": [{
              "match": {},
              "replace": "$&const [vcPronounce,vcPronounSource]=$self.useProfilePronouns(arguments[0].user.id,true);if(arguments[0].displayProfile&&vcPronounce)arguments[0].displayProfile.pronouns=vcPronounce;"
          }, {
              "match": {},
              "replace": "$& + (typeof vcPronounSource !== \"undefined\" ? ` (${vcPronounSource})` : \"\")"
          }],
          "plugin": "PronounDB"
      }, {
          "find": "showBorder:null",
          "replacement": [{
              "match": {},
              "replace": "$&,$self.getReviewsComponent($1)"
          }],
          "plugin": "ReviewDB"
      }, {
          "find": "{isUsingGuildBio:null!==(",
          "replacement": [{
              "match": {},
              "replace": "$&,$self.profilePopoutComponent({ user: arguments[0].user, displayProfile: arguments[0].displayProfile })"
          }],
          "plugin": "ShowConnections"
      }, {
          "find": ".PROFILE_PANEL,",
          "replacement": [{
              "match": {},
              "replace": "$self.profilePanelComponent({ id: $1.recipients[0] }),$&"
          }],
          "plugin": "ShowConnections"
      }, {
          "find": ".Messages.MUTUAL_GUILDS_WITH_END_COUNT",
          "replacement": [{
              "match": {},
              "replace": "$&$self.patchModal(arguments[0]),"
          }],
          "plugin": "UserVoiceShow"
      }, {
          "find": ".MODAL,hasProfileEffect",
          "replacement": [{
              "match": {},
              "replace": "{src:$1,onClick:()=>$self.openImage($1)"
          }],
          "plugin": "ViewIcons"
      }, {
          "find": ".avatarPositionPanel",
          "replacement": [{
              "match": {},
              "replace": "$1style:($2)?{cursor:\"pointer\"}:{},onClick:$2?()=>{$self.openImage($3)}"
          }],
          "plugin": "ViewIcons"
      }],
      "hadNoEffect": [{
          "find": ".popularApplicationCommandIds,",
          "replacement": [{
              "match": {},
              "replace": "$&Vencord.Plugins.plugins[\"BetterNotesBox\"].patchPadding({lastSection:$1}),"
          }],
          "plugin": "BetterNotesBox",
          "id": "777887"
      }, {
          "find": ".popularApplicationCommandIds,",
          "replacement": [{
              "match": {}
          }],
          "plugin": "PermissionsViewer",
          "id": "777887"
      }, {
          "find": ".popularApplicationCommandIds,",
          "replacement": [{
              "match": {},
              "replace": "Vencord.Plugins.plugins[\"UserVoiceShow\"].patchPopout(arguments[0]),"
          }],
          "plugin": "UserVoiceShow",
          "id": "777887"
      }, {
          "find": "this.renderArtisanalHack()",
          "replacement": [{
              "match": {},
              "replace": "$&,_:$1"
          }],
          "plugin": "DiscordColorways",
          "id": "718813"
      }, {
          "find": "Messages.USER_SETTINGS_WITH_BUILD_OVERRIDE.format",
          "replacement": [{
              "match": {},
              "replace": "(async ()=>$2)(),"
          }],
          "plugin": "DiscordColorways",
          "id": "720734"
      }, {
          "find": "Messages.USER_SETTINGS_ACTIONS_MENU_LABEL",
          "replacement": [{
              "match": {},
              "replace": "$2.default.open($1);return;"
          }],
          "plugin": "DiscordColorways",
          "id": "923422"
      }],
      "undoingPatchGroup": [],
      "erroredPatch": []
  },
  "failedWebpack": {
      "find": [],
      "findByProps": [
          ["section", "lastSection"],
          ["lastSection"]
      ],
      "findByCode": [
          [".lastSection", "children:"]
      ],
      "findStore": [],
      "findComponent": [],
      "findComponentByCode": [
          [".lastSection", "children:"]
      ],
      "findExportedComponent": [],
      "waitFor": [],
      "waitForComponent": [],
      "waitForStore": [],
      "proxyLazyWebpack": [
          ["()=>Object.assign({},...mi(he.byProps(\"roles\",\"rolePill\",\"rolePillBorder\"),he.byProps(\"roleCircle\",\"dotBorderBase\",\"dotBorderColor\"),he.byProps(\"roleNameOverflow\",\"root\",\"roleName\",\"roleRemoveButton\")))"]
      ],
      "LazyComponentWebpack": [],
      "extractAndLoadChunks": [],
      "mapMangledModule": []
  }
};

function App() {
  return (
    //@ts-ignore
    <ReporterSections data={window.reporterData}/>
  );
}

export default App;
