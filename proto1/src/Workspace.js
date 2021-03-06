/*

plans for redesigning the window manager system and tabs

instead of dragging tabs we can right click to a menu to the following:
* move tab to other window. show window names using the names of the tabs within them.
* dock tab at the bottom of the screen
* make tab become it's own window
* undock the tab (become it's own window again)

*/

import React, {Component} from "react";
import {HBox, Spacer, VBox, PopupManager} from "appy-comps";
import {nextId} from "./GUIUtils";
import DragAction from "./DragAction";
import RemoteDB from "./RemoteDB";



class IDFrame extends Component {
    constructor(props) {
        super(props);
        this.state = {
            x:200,
            y:200,
            w:300,
            h:200,
            selected:null
        };

        if(props.window.apps.length > 0) {
            this.state.selected = props.window.apps[0];
        }

        this.moveHandler = (action) => {
            this.setState({
                x:this.state.x+action.delta.x,
                y:this.state.y+action.delta.y
            });
        };
        this.resizeHandler = (action) => {
            this.setState({
                w:this.state.w+action.delta.x,
                h:this.state.h+action.delta.y
            });
        };

        this.mouseDown = (e) =>  {
            this.raiseWindow();
            this.setState({action: new DragAction(e, this.moveHandler  )});
        };
        this.resizeDown = (e) => this.setState({action: new DragAction(e, this.resizeHandler)});


        //handler for resize messages
        this.props.db.listenMessages((msg) => {
            if (msg.type !== 'command') return;
            if (msg.command !== 'resize') return;
            if(this.props.window.apps.length <= 0) return;
            if(this.props.window.apps[0].id === msg.appid) {if(msg.width)  this.setState({w:msg.width});
                if(msg.height) this.setState({h:msg.height});
            }
        });

    }

    raiseWindow = () => {
        this.props.onRaise(this.props.window);
    };

    selectTab(app) {
        this.setState({selected:app})
    }

    closeTab(app) {
        this.props.db.sendMessage({
            type: 'command',
            target: 'system',
            command: "close",
            appid: app.id
        });
    }

    moveTab = (app) => {
        this.props.workspace.moveAppTo(app,this.props.window);
    };


    render() {
        const style = {
            top: this.state.y,
            left: this.state.x,
            width: this.state.w,
            height: this.state.h,
            position: "absolute",
            backgroundClip: 'padding-box',
        };


        return <div className="window" style={style} onClickCapture={this.raiseWindow}>
            <div className="title-bar" onMouseDown={this.mouseDown} style={{  userSelect: 'none',  cursor: 'move', }}></div>

            <div className="window-content">
                <div className="tab-bar">{this.props.window.apps.map((app,i) => {
                    return <Tab key={app.id} app={app}
                                onSelect={()=>this.selectTab(app)}
                                onClose={()=>this.closeTab(app)}
                                onMove={()=>this.moveTab(app)}
                                selected={this.state.selected}/>
                })}</div>
                <div className="tab-content">{this.renderAppContent(this.state.selected)}</div>
                <div className="window-footer">
                    <Spacer/>
                    <button className="fa fa-expand fa-fw" onMouseDown={this.resizeDown}/>
                </div>
            </div>
        </div>
    }
    renderAppContent(app) {
        if(!app) return "";
        return app.instance;
    }
}

class Tab extends Component {
    render() {
        return <div className="tab">
            <span onClick={this.props.onSelect}>{this.props.app.title}</span>
            <button onClick={this.props.onClose} className="fa fa-close"/>
        </div>
    }
}

export default class Workspace extends Component {
    constructor(props) {
        super(props);
        this.state = {
            wins:[]
        };
        this.db = new RemoteDB("fakewindow");
        this.db.connect();
    }
    componentWillReceiveProps(newProps) {
        this.recalcWindows(newProps);
    }

    moveAppTo(app,win) {
        var wins = this.state.wins.slice();
        //find new random window
        let newWin = wins.find((w) => w.id !== win);
        //remove from old window
        win.apps = win.apps.filter((a) => a.id !== app.id);
        //filter out empty windows
        wins = wins.filter((win) => win.apps.length > 0);
        newWin.apps.push(app);
        this.setState({wins:wins});
    }

    //move the selected window to the top
    raiseWindow = (win) => {
        //if last, then already at the top, so bail
        if(this.state.wins[this.state.wins.length-1].id === win.id) return;
        //remove win from the list of windows
        let wins = this.state.wins.filter((w) => w.id !== win.id);
        //add win back to the end
        wins.push(win);
        //update state
        this.setState({wins:wins});
    }

    recalcWindows(props) {
        let wins = this.state.wins.slice();
        //add a window for any app without a window
        props.apps.forEach((app)=>{
            const found = wins.find((win)=> win.apps.find((a)=>a.id === app.id));
            if(!found) {
                wins.push({
                    id:nextId(),
                    apps:[app]
                });
            }
        });

        //remove any window apps that are no longer in the props.apps;
        wins.forEach((win,i)=>{
            win.apps = win.apps.filter((a) => {
                return props.apps.find((aa) => {
                    return aa.id === a.id
                });
            });
        });

        //remove any windows that are now empty
        wins = wins.filter((win) => win.apps.length > 0);

        //set the state back
        this.setState({wins:wins});
    }

    render() {
        return <div>{this.state.wins.map((w, i) => <IDFrame key={w.id} window={w} db={this.db} onRaise={this.raiseWindow} workspace={this}/>)}</div>
    }

}